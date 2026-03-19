/**
 * POST /api/internal/generate-brief — Generate AI pre-visit brief for an appointment
 *
 * Internal-only route (x-internal-key header guard).
 * Called by the /api/cron/previsit-briefs cron job (24h before appointment).
 *
 * Flow:
 *   1. Fetch appointment + patient + doctor context
 *   2. Build health context from health_memory_events (encrypted, per request)
 *   3. Generate structured brief with Gemini
 *   4. Encrypt + upsert previsit_briefs row
 *
 * PHI SAFETY: Never log health context or brief content.
 */

import { and, eq } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { db } from "@/db/client";
import { appointments, previsitBriefs, doctors } from "@/db/schema";
import { buildHealthContext } from "@/lib/health/context";
import { encryptPHI } from "@/lib/health/encryption";
import { getGeminiClient } from "@/lib/ai/client";
import { env } from "@/lib/env";

export const maxDuration = 60;

const bodySchema = z.object({
  appointmentId: z.string().uuid(),
});

export const POST = async (req: NextRequest): Promise<NextResponse> => {
  // Internal key guard
  const key = req.headers.get("x-internal-key");
  if (!key || key !== env.INTERNAL_API_KEY) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const payload = await req.json().catch(() => null);
  const parsed = bodySchema.safeParse(payload);
  if (!parsed.success) {
    return NextResponse.json({ error: "appointmentId (UUID) required" }, { status: 400 });
  }

  const { appointmentId } = parsed.data;

  // Fetch appointment with doctor info
  const [appt] = await db
    .select({
      id: appointments.id,
      patientId: appointments.patientId,
      doctorId: appointments.doctorId,
      scheduledAt: appointments.scheduledAt,
      patientNotes: appointments.patientNotes,
    })
    .from(appointments)
    .where(eq(appointments.id, appointmentId))
    .limit(1);

  if (!appt) {
    return NextResponse.json({ error: "Appointment not found" }, { status: 404 });
  }

  // Fetch doctor name for context
  let doctorName = "your doctor";
  if (appt.doctorId) {
    const [doc] = await db
      .select({ name: doctors.name, specialization: doctors.specialization })
      .from(doctors)
      .where(eq(doctors.id, appt.doctorId))
      .limit(1);
    if (doc) {
      doctorName = `${doc.name}${doc.specialization ? ` (${doc.specialization})` : ""}`;
    }
  }

  // Build health context (PHI — never log)
  const healthContext = await buildHealthContext(appt.patientId);

  // Generate brief with Gemini
  const prompt = `You are a clinical support AI. Generate a structured Pre-Visit Brief for a patient about to see ${doctorName}.

APPOINTMENT: ${appt.scheduledAt ? new Date(appt.scheduledAt).toLocaleDateString("en-IN") : "Upcoming"}
PATIENT NOTES: ${appt.patientNotes ?? "None provided"}

${healthContext ? `PATIENT HEALTH MEMORY:\n${healthContext}` : "No health history available."}

Generate a JSON pre-visit brief with this exact structure:
{
  "summary": "2-3 sentence health summary for the doctor",
  "activeConditions": ["list of current diagnoses"],
  "currentMedications": ["medication name: dose frequency"],
  "recentLabsHighlights": ["key recent lab findings with values"],
  "vitalsHighlights": ["key recent vitals"],
  "reasonForVisit": "inferred reason based on patient notes and history",
  "questionsForDoctor": ["suggested questions the patient should ask"],
  "redFlags": ["urgent issues the doctor should be aware of, if any"]
}

Respond ONLY with valid JSON. No markdown, no explanation.`;

  try {
    const genAI = getGeminiClient();
    const model = genAI.getGenerativeModel({
      model: env.GEMINI_MODEL ?? "gemini-2.5-flash",
      generationConfig: {
        temperature: 0.1,
        responseMimeType: "application/json",
      },
    });

    const result = await model.generateContent(prompt);
    const briefText = result.response.text();
    const briefData = JSON.parse(briefText) as Record<string, unknown>;

    // Encrypt and upsert
    const briefEncrypted = encryptPHI(briefData);

    await db
      .insert(previsitBriefs)
      .values({
        appointmentId,
        patientId: appt.patientId,
        doctorId: appt.doctorId ?? null,
        briefEncrypted,
        generatedAt: new Date(),
      })
      .onConflictDoUpdate({
        target: previsitBriefs.appointmentId,
        set: {
          briefEncrypted,
          generatedAt: new Date(),
          viewedAt: null,
        },
      });

    return NextResponse.json({ message: "Brief generated", appointmentId });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Generation failed";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
};
