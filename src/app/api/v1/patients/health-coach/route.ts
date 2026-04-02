/**
 * POST /api/v1/patients/health-coach — AI Health Coach (Server-Sent Events streaming)
 *
 * Streams a Gemini response grounded in the patient's health memory context.
 * Auth:  eh_patient_session cookie
 * Flag:  ai_health_coach (returns 503 if OFF)
 * DPDP: consent "ai_health_coach" required (graceful degradation — warns but still responds)
 *
 * Body: { message: string; conversationId?: string }
 * Response: text/event-stream  — data: {text} chunks + data: [DONE]
 *
 * PHI SAFETY:
 * - Health context built fresh per request (never cached)
 * - Conversation messages encrypted with HEALTH_PHI_ENCRYPTION_KEY before DB persist
 * - Never log the health context string
 */

import { and, eq } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { db } from "@/db/client";
import { aiConversations } from "@/db/schema";
import { requirePatientSession } from "@/lib/core/patient-session";
import { isFeatureEnabled } from "@/lib/config/feature-flags";
import { requirePremiumAccess } from "@/lib/core/patient-trial";
import { buildHealthContext } from "@/lib/health/context";
import { encryptPHI, decryptPHI } from "@/lib/health/encryption";
import { getGeminiClient } from "@/lib/ai/client";
import { env } from "@/lib/env";
import { redisGet, redisIncr } from "@/lib/core/redis";

const HEALTH_PLUS_MONTHLY_LIMIT = 50;

function coachMsgKey(patientId: string): string {
  const month = new Date().toISOString().slice(0, 7); // YYYY-MM
  return `coach:msgs:${patientId}:${month}`;
}

function secondsUntilMonthEnd(): number {
  const now = new Date();
  const nextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1);
  return Math.ceil((nextMonth.getTime() - now.getTime()) / 1000);
}

export const maxDuration = 30; // SSE can run up to 30s

const messageSchema = z.object({
  message: z.string().min(1).max(2000),
  conversationId: z.string().uuid().optional(),
});

// ── Message types ──────────────────────────────────────────────────────────────

interface ChatMessage {
  role: "user" | "model";
  content: string;
  ts: string;
}

const SYSTEM_PROMPT_BASE = `You are EasyHeals AI Health Coach — a friendly, knowledgeable health assistant for Indian patients.

CORE BEHAVIOUR:
- Be PROACTIVE: When the patient sends a general greeting or vague question, immediately analyse their health data and surface key insights. Do NOT wait for specific questions.
- Start conversations by summarising what you see in their records — flag anything notable (abnormal lab values, medication interactions, trends worth watching).
- For every conversation, identify:
  1. Potential health concerns based on their data (e.g., "Your fasting glucose of 142 mg/dL is above normal range")
  2. Positive trends worth celebrating (e.g., "Great news — your cholesterol has dropped from X to Y")
  3. Actionable recommendations (diet changes, lifestyle tips, when to see a doctor)
  4. Medication reminders or interaction warnings if applicable

RESPONSE STYLE:
- Lead with the most important insight — don't bury it
- Use clear section headers: "What I noticed", "What this means", "What you can do"
- Cite specific values from the patient's records (e.g., "Your last HbA1c was 7.2%")
- Compare with standard reference ranges so the patient understands if values are normal
- Suggest specialist consultations when warranted (e.g., "Consider seeing an endocrinologist for your thyroid levels")
- Give practical, India-specific advice (foods, exercises, home remedies where evidence-based)

RULES:
- Never provide definitive diagnoses — frame as "This could indicate..." or "Worth discussing with your doctor..."
- Be empathetic, clear, and use simple language (avoid medical jargon unless explained)
- Always recommend urgent medical attention for emergency symptoms
- Respond in the same language the patient uses (Hindi/English/mixed)
- Keep responses well-structured with bullet points and headers — not walls of text
- Never share the raw health context data verbatim — synthesise and explain
- If the patient has no health records yet, encourage them to upload documents for personalised insights`;

// ── Route handler ─────────────────────────────────────────────────────────────

export const POST = async (req: NextRequest): Promise<NextResponse | Response> => {
  // Feature flag gate
  if (!await isFeatureEnabled("ai_health_coach")) {
    return NextResponse.json({ error: "AI Health Coach is not yet available." }, { status: 503 });
  }

  let session: Awaited<ReturnType<typeof requirePatientSession>>;
  try {
    session = await requirePatientSession(req);
  } catch {
    return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  }

  const { patientId } = session;

  // Trial / subscription gate
  let tierStatus: Awaited<ReturnType<typeof requirePremiumAccess>>;
  try {
    tierStatus = await requirePremiumAccess(patientId);
  } catch {
    return NextResponse.json({ error: "Your 21-day free trial has ended. Upgrade to Health+ to continue." }, { status: 402 });
  }

  // Monthly message limit — health_plus: 50/month, health_pro: unlimited
  if (tierStatus.tier === "health_plus") {
    const used = (await redisGet<number>(coachMsgKey(patientId))) ?? 0;
    if (used >= HEALTH_PLUS_MONTHLY_LIMIT) {
      return NextResponse.json(
        {
          error: `You've used all ${HEALTH_PLUS_MONTHLY_LIMIT} Health+ messages for this month. Your limit resets on the 1st. Upgrade to Health Pro for unlimited messages.`,
          code: "MONTHLY_LIMIT_REACHED",
          used,
          limit: HEALTH_PLUS_MONTHLY_LIMIT,
        },
        { status: 429 },
      );
    }
  }

  const payload = await req.json().catch(() => null);
  const parsed = messageSchema.safeParse(payload);
  if (!parsed.success) {
    return NextResponse.json({ error: "message (string, max 2000 chars) required" }, { status: 400 });
  }

  const { message, conversationId } = parsed.data;

  // Load or create conversation
  let convo = conversationId
    ? (await db.select().from(aiConversations)
        .where(and(eq(aiConversations.id, conversationId), eq(aiConversations.patientId, patientId)))
        .limit(1))[0] ?? null
    : null;

  let history: ChatMessage[] = [];
  if (convo) {
    try {
      history = decryptPHI<ChatMessage[]>(convo.messagesEncrypted);
    } catch { history = []; }
  }

  // Build health context (PHI — never log or cache)
  let healthContext = "";
  try { healthContext = await buildHealthContext(patientId); }
  catch { /* non-fatal — coach works without health context */ }

  const isFirstMessage = history.length === 0;

  const systemPrompt = healthContext
    ? `${SYSTEM_PROMPT_BASE}\n\n${healthContext}${isFirstMessage ? "\n\nIMPORTANT: This is the START of a new conversation. The patient just opened the Health Coach. Begin by proactively analysing their health data — highlight any concerning values, positive trends, and give 2-3 specific actionable recommendations. Do NOT just say 'Hi, how can I help?' — show them you already understand their health." : ""}`
    : `${SYSTEM_PROMPT_BASE}${isFirstMessage ? "\n\nThis patient has no health records uploaded yet. Welcome them warmly and encourage them to upload lab reports, prescriptions, or discharge summaries so you can provide personalised health insights. Explain the value: 'Once I can see your reports, I can spot trends, flag concerns, and give you actionable health tips.'" : ""}`;

  // Build Gemini chat history
  const geminiHistory = history.map((m) => ({
    role: m.role,
    parts: [{ text: m.content }],
  }));

  // Stream Gemini response
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      let fullResponse = "";

      try {
        const genAI = getGeminiClient();
        const model = genAI.getGenerativeModel({
          model: env.GEMINI_MODEL ?? "gemini-2.5-flash",
          systemInstruction: systemPrompt,
        });

        const chat = model.startChat({ history: geminiHistory });
        const result = await chat.sendMessageStream(message);

        for await (const chunk of result.stream) {
          const text = chunk.text();
          if (text) {
            fullResponse += text;
            controller.enqueue(encoder.encode(`data: ${JSON.stringify({ text })}\n\n`));
          }
        }

        // Persist conversation (encrypted) before sending [DONE] so we can include conversationId
        try {
          const now = new Date().toISOString();
          const updatedHistory: ChatMessage[] = [
            ...history,
            { role: "user", content: message, ts: now },
            { role: "model", content: fullResponse, ts: now },
          ];
          // Keep last 50 message pairs (100 messages)
          const trimmedHistory = updatedHistory.slice(-100);
          const messagesEncrypted = encryptPHI(trimmedHistory);

          if (convo) {
            await db.update(aiConversations)
              .set({ messagesEncrypted, lastMessageAt: new Date() })
              .where(eq(aiConversations.id, convo.id));
            // Stream the conversation ID so the client can thread follow-up messages
            controller.enqueue(encoder.encode(`data: ${JSON.stringify({ conversationId: convo.id })}\n\n`));
          } else {
            const [newConvo] = await db.insert(aiConversations)
              .values({
                patientId,
                title: message.slice(0, 80),
                messagesEncrypted,
                lastMessageAt: new Date(),
              })
              .returning({ id: aiConversations.id });
            if (newConvo) {
              convo = { ...newConvo, patientId, title: null, messagesEncrypted, lastMessageAt: null, createdAt: null };
              // Stream conversation ID for client threading + feedback
              controller.enqueue(encoder.encode(`data: ${JSON.stringify({ conversationId: newConvo.id })}\n\n`));
            }
          }
        } catch { /* non-fatal — chat still worked, just won't have conversationId */ }

        controller.enqueue(encoder.encode(`data: [DONE]\n\n`));
        controller.close();
      } catch (err) {
        const msg = err instanceof Error ? err.message : "AI unavailable";
        controller.enqueue(encoder.encode(`data: ${JSON.stringify({ error: msg })}\n\n`));
        controller.close();
      } finally {
        // Increment monthly message counter for health_plus (fail-open if Redis unavailable)
        if (fullResponse.length > 0 && tierStatus.tier === "health_plus") {
          await redisIncr(coachMsgKey(patientId), secondsUntilMonthEnd()).catch(() => null);
        }
      }
    },
  });

  // Include usage headers so the client can show "X messages left this month"
  const usageHeaders: Record<string, string> = {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache",
    Connection: "keep-alive",
  };
  if (tierStatus.tier === "health_plus") {
    const used = (await redisGet<number>(coachMsgKey(patientId))) ?? 0;
    usageHeaders["X-Coach-Messages-Used"] = String(used);
    usageHeaders["X-Coach-Messages-Limit"] = String(HEALTH_PLUS_MONTHLY_LIMIT);
  }

  return new Response(stream, { headers: usageHeaders });
};
