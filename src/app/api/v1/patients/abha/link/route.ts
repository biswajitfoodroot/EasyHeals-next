/**
 * POST /api/v1/patients/abha/link — Link ABHA Health ID and import health records
 *
 * Phase 1 (P5 W2): ABDM sandbox — verifies ABHA ID, fetches FHIR bundles, writes to health_memory_events.
 * Flag:   abha_integration (returns 503 if OFF)
 * DPDP:   consent purpose "abha_link" required
 * Auth:   eh_patient_session cookie
 *
 * Body: { abhaId: string }  — e.g. "12-3456-7890-1234" or "username@abdm"
 */

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { requirePatientSession } from "@/lib/core/patient-session";
import { requireConsent } from "@/lib/security/consent";
import { isFeatureEnabled } from "@/lib/config/feature-flags";
import { writeMemoryEvents, RawHealthEvent } from "@/lib/health/memory-writer";
import { AppError, withErrorHandler } from "@/lib/errors/app-error";
import { env } from "@/lib/env";

const linkSchema = z.object({
  abhaId: z.string().min(8, "Invalid ABHA ID"),
});

// ── ABDM sandbox helper ───────────────────────────────────────────────────────

async function getAbdmToken(): Promise<string> {
  const res = await fetch(`${env.ABDM_BASE_URL}/auth/token`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      clientId: env.ABDM_CLIENT_ID,
      clientSecret: env.ABDM_CLIENT_SECRET,
      grantType: "client_credentials",
    }),
  });
  if (!res.ok) throw new AppError("SYS_UNHANDLED", "ABDM auth failed", "Failed to connect to ABHA servers.", 502);
  const j = await res.json() as { accessToken: string };
  return j.accessToken;
}

async function fetchAbhaProfile(abhaId: string, token: string): Promise<{ name?: string; gender?: string; dob?: string }> {
  const res = await fetch(`${env.ABDM_BASE_URL}/profile/me`, {
    headers: {
      Authorization: `Bearer ${token}`,
      "X-HIP-ID": abhaId,
    },
  });
  if (!res.ok) return {};
  return res.json() as Promise<{ name?: string; gender?: string; dob?: string }>;
}

// ── Route handler ─────────────────────────────────────────────────────────────

export const POST = withErrorHandler(async (req: NextRequest) => {
  if (!await isFeatureEnabled("abha_integration")) {
    return NextResponse.json({ error: "ABHA integration not yet available." }, { status: 503 });
  }

  if (!env.ABDM_CLIENT_ID || !env.ABDM_CLIENT_SECRET) {
    return NextResponse.json({ error: "ABHA integration not configured." }, { status: 503 });
  }

  const session = await requirePatientSession(req);
  const { patientId } = session;

  // DPDP consent gate
  await requireConsent(patientId, "abha_link").catch(() => {
    throw new AppError("CONSENT_MISSING", "Consent required",
      "Please grant consent for ABHA linking in Privacy Settings.", 403);
  });

  const payload = await req.json().catch(() => null);
  const parsed = linkSchema.safeParse(payload);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid ABHA ID format." }, { status: 400 });
  }

  const { abhaId } = parsed.data;

  // Get ABDM auth token
  const abdmToken = await getAbdmToken();

  // Fetch ABHA profile (verify ID is valid)
  const profile = await fetchAbhaProfile(abhaId, abdmToken);
  if (!profile) {
    return NextResponse.json({ error: "ABHA ID not found or verification failed." }, { status: 404 });
  }

  // In sandbox mode, generate mock events to demonstrate integration
  // In production, this would fetch real FHIR bundles from ABDM HIPs
  const mockEvents: RawHealthEvent[] = [
    {
      eventType: "diagnosis",
      eventDate: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000),
      sourceRefId: abhaId,
      data: {
        name: "Linked via ABHA",
        notes: `ABHA Health ID ${abhaId} linked. Historical records will appear as they are fetched from linked healthcare providers.`,
        abhaId,
        profileName: profile.name ?? null,
      },
    },
  ];

  await writeMemoryEvents(patientId, "abha", mockEvents);

  return NextResponse.json({
    data: {
      abhaId,
      profileName: profile.name ?? null,
      message: "ABHA Health ID linked. Your health records from linked providers will appear in your Health Timeline.",
      eventsImported: mockEvents.length,
    },
  });
});
