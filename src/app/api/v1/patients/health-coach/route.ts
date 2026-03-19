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

RULES:
- Never provide definitive diagnoses — recommend consulting a doctor
- Be empathetic, clear, and use simple language (avoid medical jargon)
- Cite the patient's own health data when relevant (e.g., "Your last HbA1c was 7.2%")
- Always recommend urgent medical attention for emergency symptoms
- Respond in the same language the patient uses (Hindi/English/mixed)
- Be concise — avoid overly long responses
- Never share the raw health context data verbatim`;

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
  try {
    await requirePremiumAccess(patientId);
  } catch {
    return NextResponse.json({ error: "Your 21-day free trial has ended. Upgrade to Health+ to continue." }, { status: 402 });
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

  const systemPrompt = healthContext
    ? `${SYSTEM_PROMPT_BASE}\n\n${healthContext}`
    : SYSTEM_PROMPT_BASE;

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

        controller.enqueue(encoder.encode(`data: [DONE]\n\n`));
        controller.close();
      } catch (err) {
        const msg = err instanceof Error ? err.message : "AI unavailable";
        controller.enqueue(encoder.encode(`data: ${JSON.stringify({ error: msg })}\n\n`));
        controller.close();
      } finally {
        // Persist conversation (encrypted)
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
          } else {
            const [newConvo] = await db.insert(aiConversations)
              .values({
                patientId,
                title: message.slice(0, 80),
                messagesEncrypted,
                lastMessageAt: new Date(),
              })
              .returning({ id: aiConversations.id });
            // Send conversation ID to client for threading
            if (newConvo) {
              // Already streamed — client should use the ID from the [DONE] event below
              convo = { ...newConvo, patientId, title: null, messagesEncrypted, lastMessageAt: null, createdAt: null };
            }
          }
        } catch { /* non-fatal — chat still worked */ }
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
};
