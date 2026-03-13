import { eq } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { db } from "@/db/client";
import { roles, userRoleMap, users } from "@/db/schema";
import { createSession, setSessionCookie } from "@/lib/session";

const bodySchema = z.object({ idToken: z.string().min(10) });

type GoogleTokenInfo = {
  sub: string;
  email: string;
  name: string;
  picture: string;
  email_verified: string;
  aud: string;
};

async function verifyGoogleToken(idToken: string): Promise<GoogleTokenInfo | null> {
  try {
    const res = await fetch(
      `https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(idToken)}`,
    );
    if (!res.ok) return null;
    const data = (await res.json()) as GoogleTokenInfo & { error?: string };
    if (data.error) return null;
    const expectedAud = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;
    if (expectedAud && data.aud !== expectedAud) return null;
    return data;
  } catch {
    return null;
  }
}

async function ensureContributorRoleId(): Promise<string | null> {
  const existing = await db
    .select({ id: roles.id })
    .from(roles)
    .where(eq(roles.code, "contributor"))
    .limit(1);

  if (existing[0]) return existing[0].id;

  const [inserted] = await db
    .insert(roles)
    .values({ code: "contributor", label: "Community Contributor" })
    .returning({ id: roles.id });

  return inserted?.id ?? null;
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  const info = await verifyGoogleToken(parsed.data.idToken);
  if (!info || info.email_verified !== "true") {
    return NextResponse.json({ error: "Invalid or unverified Google token" }, { status: 401 });
  }

  // Upsert user by googleId first, then email
  let userId: string;
  const byGoogleId = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.googleId, info.sub))
    .limit(1);

  if (byGoogleId[0]) {
    userId = byGoogleId[0].id;
    // Refresh name/avatar
    await db
      .update(users)
      .set({ fullName: info.name, googleAvatar: info.picture, updatedAt: new Date() })
      .where(eq(users.id, userId));
  } else {
    // Check by email
    const byEmail = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.email, info.email))
      .limit(1);

    if (byEmail[0]) {
      userId = byEmail[0].id;
      await db
        .update(users)
        .set({ googleId: info.sub, googleAvatar: info.picture, updatedAt: new Date() })
        .where(eq(users.id, userId));
    } else {
      // Create new contributor user
      const [newUser] = await db
        .insert(users)
        .values({
          fullName: info.name,
          email: info.email,
          googleId: info.sub,
          googleAvatar: info.picture,
        })
        .returning({ id: users.id });

      userId = newUser.id;

      // Assign contributor role
      const roleId = await ensureContributorRoleId();
      if (roleId) {
        await db.insert(userRoleMap).values({ userId, roleId });
      }
    }
  }

  const { sessionToken, expiresAt } = await createSession(userId);
  await setSessionCookie(sessionToken, expiresAt);

  // Fetch the saved user for response
  const [savedUser] = await db
    .select({ fullName: users.fullName, email: users.email, googleAvatar: users.googleAvatar })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);

  return NextResponse.json({
    userId,
    name: savedUser?.fullName ?? info.name,
    email: savedUser?.email ?? info.email,
    avatar: savedUser?.googleAvatar ?? info.picture,
  });
}
