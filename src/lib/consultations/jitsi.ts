/**
 * src/lib/consultations/jitsi.ts
 *
 * P3 Day 3 — Jitsi Meet free-tier provider (PLAN.md §P3 Consultation Room).
 *
 * Supports two modes:
 *   1. Public meet.jit.si  — JITSI_APP_ID unset; no JWT; anonymous rooms
 *   2. JaaS / custom Jitsi — JITSI_APP_ID + JITSI_APP_SECRET set; HS256 JWT signed
 *      with shared secret (for self-hosted Jitsi / JaaS token-auth mode)
 *
 * JWT standard: https://jitsi.github.io/handbook/docs/devops-guide/devops-guide-docker
 * For full JaaS RS256 production, switch to the `jose` package.
 *
 * Room name: deterministic from appointmentId (sha256 prefix) so re-starting
 * the same appointment always lands in the same room.
 */

import { createHash, createHmac } from "crypto";

// ── Config ────────────────────────────────────────────────────────────────────

const JITSI_DOMAIN = process.env.JITSI_DOMAIN ?? "meet.jit.si";
const JITSI_APP_ID = process.env.JITSI_APP_ID ?? "";
const JITSI_APP_SECRET = process.env.JITSI_APP_SECRET ?? "";

export const isJitsiConfigured = (): boolean => !!JITSI_APP_ID && !!JITSI_APP_SECRET;

// ── Room name ─────────────────────────────────────────────────────────────────

/**
 * Generate a deterministic room name from the appointmentId.
 * Format: eh-{12 hex chars} — short enough for a URL, not guessable.
 */
export function generateRoomName(appointmentId: string): string {
  const hash = createHash("sha256").update(`room:${appointmentId}`).digest("hex");
  return `eh-${hash.slice(0, 12)}`;
}

// ── JWT (HS256) ───────────────────────────────────────────────────────────────

function base64url(input: string | Buffer): string {
  const buf = typeof input === "string" ? Buffer.from(input, "utf8") : input;
  return buf.toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=/g, "");
}

export interface JitsiParticipant {
  name: string;
  email?: string;
  avatarUrl?: string;
  isModerator?: boolean; // doctor = true, patient = false
}

/**
 * Generate a Jitsi JWT (HS256).
 * Only called when JITSI_APP_ID + JITSI_APP_SECRET are set.
 * TTL: 2 hours (covers the longest allowed session timeout).
 */
export function generateJitsiToken(room: string, participant: JitsiParticipant): string {
  if (!JITSI_APP_ID || !JITSI_APP_SECRET) {
    throw new Error("JITSI_APP_ID and JITSI_APP_SECRET must be set to generate Jitsi JWTs");
  }

  const now = Math.floor(Date.now() / 1000);
  const exp = now + 2 * 60 * 60; // 2 hours

  const header = { alg: "HS256", typ: "JWT" };
  const payload = {
    context: {
      user: {
        name: participant.name,
        email: participant.email ?? "",
        avatar: participant.avatarUrl ?? "",
        id: createHash("sha256").update(participant.name + room).digest("hex").slice(0, 16),
      },
      features: {
        recording: false,
        livestreaming: false,
        "screen-sharing": true,
        "outbound-call": false,
      },
    },
    aud: "jitsi",
    iss: JITSI_APP_ID,
    sub: JITSI_DOMAIN,
    room,
    exp,
    nbf: now,
    moderator: participant.isModerator ?? false,
  };

  const headerB64 = base64url(JSON.stringify(header));
  const payloadB64 = base64url(JSON.stringify(payload));
  const signingInput = `${headerB64}.${payloadB64}`;

  const sig = createHmac("sha256", JITSI_APP_SECRET)
    .update(signingInput)
    .digest("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=/g, "");

  return `${signingInput}.${sig}`;
}

// ── Join URL builder ──────────────────────────────────────────────────────────

/**
 * Build the embeddable Jitsi room URL.
 *
 * With JWT:    https://{domain}/{appId}/{room}?jwt={token}
 * Without JWT: https://{domain}/{room}
 *
 * The EasyHeals consultation page renders this in an <iframe> (free tier)
 * or via the Jitsi IFrame API (for custom branding in paid tier).
 */
export function buildJoinUrl(room: string, token?: string): string {
  if (JITSI_APP_ID && token) {
    // JaaS or custom server with app ID namespace
    return `https://${JITSI_DOMAIN}/${JITSI_APP_ID}/${room}?jwt=${token}`;
  }
  return `https://${JITSI_DOMAIN}/${room}`;
}

/**
 * Build participant-specific join URL.
 * If JWT is configured → signs token; otherwise returns public URL.
 */
export function buildParticipantJoinUrl(
  room: string,
  participant: JitsiParticipant,
): string {
  if (isJitsiConfigured()) {
    const token = generateJitsiToken(room, participant);
    return buildJoinUrl(room, token);
  }
  return buildJoinUrl(room);
}
