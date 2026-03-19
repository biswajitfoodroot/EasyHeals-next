/**
 * POST /api/v1/auth/logout — Patient sign-out
 *
 * Deletes the Redis/DB patient session and clears the eh_patient_session cookie.
 */

import { NextRequest, NextResponse } from "next/server";
import { PATIENT_COOKIE, deletePatientSession } from "@/lib/core/patient-session";

export async function POST(req: NextRequest) {
  const rawToken = req.cookies.get(PATIENT_COOKIE)?.value;

  // Delete server-side session (Redis or DB) — best effort
  if (rawToken) {
    await deletePatientSession(rawToken).catch(() => {});
  }

  // Clear the cookie regardless
  const response = NextResponse.json({ message: "Signed out" });
  response.cookies.set(PATIENT_COOKIE, "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 0, // expire immediately
  });

  return response;
}
