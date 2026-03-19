/**
 * src/lib/notifications/fcm.provider.ts
 *
 * P3 Day 4 — Firebase Cloud Messaging (FCM) push notification provider.
 *
 * Uses the Firebase Cloud Messaging v1 REST API — no npm package required.
 * Authenticates with a Service Account JWT (RS256) → exchanges for OAuth2 token.
 *
 * Required env vars:
 *   FIREBASE_PROJECT_ID   — Firebase project ID
 *   FIREBASE_CLIENT_EMAIL — Service account email
 *   FIREBASE_PRIVATE_KEY  — RSA private key PEM (with \\n escaped)
 *
 * Token caching: access token is cached in-process for 55 minutes to avoid
 * re-signing on every request (tokens expire in 60 minutes).
 *
 * Reference:
 *   https://firebase.google.com/docs/cloud-messaging/send-message
 *   https://developers.google.com/identity/protocols/oauth2/service-account
 */

import { createSign } from "crypto";
import type { PushSender } from "./provider.interface";

// ── Config ────────────────────────────────────────────────────────────────────

const PROJECT_ID = process.env.FIREBASE_PROJECT_ID ?? "";
const CLIENT_EMAIL = process.env.FIREBASE_CLIENT_EMAIL ?? "";
const PRIVATE_KEY_RAW = process.env.FIREBASE_PRIVATE_KEY ?? "";

export function isFcmConfigured(): boolean {
  return !!(PROJECT_ID && CLIENT_EMAIL && PRIVATE_KEY_RAW);
}

// ── JWT / OAuth2 token ────────────────────────────────────────────────────────

interface CachedToken {
  token: string;
  expiresAt: number; // unix ms
}

let _tokenCache: CachedToken | null = null;

function base64url(input: Buffer | string): string {
  const buf = typeof input === "string" ? Buffer.from(input, "utf8") : input;
  return buf.toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=/g, "");
}

function buildServiceAccountJwt(): string {
  const now = Math.floor(Date.now() / 1000);
  const header = { alg: "RS256", typ: "JWT" };
  const payload = {
    iss: CLIENT_EMAIL,
    sub: CLIENT_EMAIL,
    aud: "https://oauth2.googleapis.com/token",
    iat: now,
    exp: now + 3600,
    scope: "https://www.googleapis.com/auth/firebase.messaging",
  };

  const headerB64 = base64url(JSON.stringify(header));
  const payloadB64 = base64url(JSON.stringify(payload));
  const signingInput = `${headerB64}.${payloadB64}`;

  // Unescape \\n → \n in PEM key
  const privateKey = PRIVATE_KEY_RAW.replace(/\\n/g, "\n");

  const sign = createSign("RSA-SHA256");
  sign.update(signingInput);
  const sig = sign.sign(privateKey, "base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=/g, "");

  return `${signingInput}.${sig}`;
}

async function getAccessToken(): Promise<string> {
  // Return cached token if still valid (55 min buffer)
  if (_tokenCache && _tokenCache.expiresAt > Date.now() + 5 * 60 * 1000) {
    return _tokenCache.token;
  }

  const jwt = buildServiceAccountJwt();

  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: jwt,
    }),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`FCM OAuth2 token exchange failed: ${res.status} ${text}`);
  }

  const data = (await res.json()) as { access_token: string; expires_in: number };

  _tokenCache = {
    token: data.access_token,
    expiresAt: Date.now() + (data.expires_in - 60) * 1000, // 60s safety buffer
  };

  return _tokenCache.token;
}

// ── FCM Provider ──────────────────────────────────────────────────────────────

export class FCMProvider implements PushSender {
  async sendPushNotification(
    deviceToken: string,
    title: string,
    body: string,
    data?: Record<string, string>,
  ): Promise<void> {
    if (!isFcmConfigured()) {
      console.warn("[FCM] Push not configured — skipping notification");
      return;
    }

    const accessToken = await getAccessToken();

    const message = {
      message: {
        token: deviceToken,
        notification: { title, body },
        data: data ?? {},
        android: {
          priority: "high",
          notification: { sound: "default", click_action: "FLUTTER_NOTIFICATION_CLICK" },
        },
        apns: {
          payload: { aps: { sound: "default", badge: 1, "content-available": 1 } },
        },
      },
    };

    const res = await fetch(
      `https://fcm.googleapis.com/v1/projects/${PROJECT_ID}/messages:send`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(message),
      },
    );

    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: "unknown" }));
      throw new Error(`FCM send failed: ${JSON.stringify(err)}`);
    }
  }

  /**
   * Send to multiple device tokens (batched — one request per token).
   * FCM v1 API does not support multicast in a single call.
   * Returns counts of sent/failed.
   */
  async sendMulticast(
    deviceTokens: string[],
    title: string,
    body: string,
    data?: Record<string, string>,
  ): Promise<{ sent: number; failed: number }> {
    const results = await Promise.allSettled(
      deviceTokens.map((token) => this.sendPushNotification(token, title, body, data)),
    );

    const sent = results.filter((r) => r.status === "fulfilled").length;
    const failed = results.filter((r) => r.status === "rejected").length;

    if (failed > 0) {
      console.warn(`[FCM] Multicast: ${sent} sent, ${failed} failed`);
    }

    return { sent, failed };
  }
}

/** Singleton instance — created lazily */
let _instance: FCMProvider | null = null;

export function getFCMProvider(): FCMProvider {
  if (!_instance) _instance = new FCMProvider();
  return _instance;
}
