import { NextRequest, NextResponse } from "next/server";

import { SESSION_COOKIE, clearSessionCookie, deleteSession } from "@/lib/session";

export async function POST(req: NextRequest) {
  const sessionToken = req.cookies.get(SESSION_COOKIE)?.value;

  if (sessionToken) {
    await deleteSession(sessionToken);
  }

  await clearSessionCookie();
  return NextResponse.json({ ok: true });
}
