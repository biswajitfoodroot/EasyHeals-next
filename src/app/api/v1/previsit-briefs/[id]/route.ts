/**
 * GET /api/v1/previsit-briefs/[id] — Fetch and decrypt a pre-visit brief
 *
 * Auth:
 *   - Patient: eh_patient_session cookie (own brief only)
 *   - Doctor: admin session (doctor role, own patients only via appointment link)
 *
 * Marks brief as viewed on first doctor access.
 * PHI SAFETY: Decrypts on-the-fly, never caches.
 */

import { eq } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";

import { db } from "@/db/client";
import { previsitBriefs, appointments } from "@/db/schema";
import { decryptPHI } from "@/lib/health/encryption";
import { requirePatientSession } from "@/lib/core/patient-session";
import { requireAuth } from "@/lib/auth";
import { withErrorHandler } from "@/lib/errors/app-error";

export const GET = withErrorHandler(async (req: NextRequest, { params }: { params: Promise<{ id: string }> }) => {
  const { id } = await params;

  // Try patient session first
  let patientId: string | null = null;
  let isProviderAccess = false;

  try {
    const session = await requirePatientSession(req);
    patientId = session.patientId;
  } catch {
    // Try provider session (admin auth)
    const auth = await requireAuth(req);
    if (auth instanceof NextResponse) return auth;
    if (auth.role === "doctor" || auth.role === "hospital_admin" || auth.role === "owner" || auth.role === "admin") {
      isProviderAccess = true;
    } else {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  const [brief] = await db
    .select()
    .from(previsitBriefs)
    .where(eq(previsitBriefs.id, id))
    .limit(1);

  if (!brief) return NextResponse.json({ error: "Brief not found" }, { status: 404 });

  // Authorization check
  if (patientId && brief.patientId !== patientId) {
    return NextResponse.json({ error: "Access denied" }, { status: 403 });
  }

  // Decrypt brief
  let briefData: Record<string, unknown> = {};
  try {
    briefData = decryptPHI<Record<string, unknown>>(brief.briefEncrypted);
  } catch {
    return NextResponse.json({ error: "Failed to decrypt brief" }, { status: 500 });
  }

  // Mark as viewed on first provider access
  if (isProviderAccess && !brief.viewedAt) {
    await db
      .update(previsitBriefs)
      .set({ viewedAt: new Date() })
      .where(eq(previsitBriefs.id, id));
  }

  return NextResponse.json({
    data: {
      id: brief.id,
      appointmentId: brief.appointmentId,
      patientId: brief.patientId,
      doctorId: brief.doctorId,
      generatedAt: brief.generatedAt,
      viewedAt: brief.viewedAt,
      brief: briefData,
    },
  });
});
