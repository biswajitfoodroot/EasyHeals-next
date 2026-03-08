import { randomUUID } from "crypto";

import { eq } from "drizzle-orm";
import { cookies } from "next/headers";

import { db } from "@/db/client";
import { sessions } from "@/db/schema";

export const SESSION_COOKIE = "easyheals_next_session";
const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000;

export async function createSession(userId: string) {
  const sessionToken = randomUUID();
  const expiresAt = new Date(Date.now() + SESSION_TTL_MS);

  await db.insert(sessions).values({ sessionToken, userId, expiresAt });

  return {
    sessionToken,
    expiresAt,
  };
}

export async function deleteSession(sessionToken: string) {
  await db.delete(sessions).where(eq(sessions.sessionToken, sessionToken));
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

