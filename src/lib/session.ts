import { createHash, randomUUID } from "crypto";

import { eq } from "drizzle-orm";
import { cookies } from "next/headers";

import { db } from "@/db/client";
import { sessions } from "@/db/schema";

export const SESSION_COOKIE = "easyheals_next_session";
const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000;

/** Hash a raw session token before storing or querying. DB never sees the raw UUID. */
export function hashSessionToken(raw: string): string {
  return createHash("sha256").update(raw).digest("hex");
}

export async function createSession(userId: string) {
  const rawToken = randomUUID();
  const tokenHash = hashSessionToken(rawToken);
  const expiresAt = new Date(Date.now() + SESSION_TTL_MS);

  await db.delete(sessions).where(eq(sessions.userId, userId));
  await db.insert(sessions).values({ sessionToken: tokenHash, userId, expiresAt });

  // Return the raw token — this is what goes into the cookie, never stored in DB
  return {
    sessionToken: rawToken,
    expiresAt,
  };
}

export async function deleteSession(rawToken: string) {
  await db.delete(sessions).where(eq(sessions.sessionToken, hashSessionToken(rawToken)));
}

export async function setSessionCookie(sessionToken: string, expiresAt: Date) {
  const cookieStore = await cookies();

  cookieStore.set(SESSION_COOKIE, sessionToken, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    expires: expiresAt,
  });
}

export async function clearSessionCookie() {
  const cookieStore = await cookies();
  cookieStore.delete(SESSION_COOKIE);
}

