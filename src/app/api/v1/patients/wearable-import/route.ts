/**
 * POST /api/v1/patients/wearable-import — Phase A wearable data import
 *
 * Accepts a JSON file export from Google Health Connect or Apple Health
 * (XML converted to JSON by the client). Parses health data points and
 * stores them as healthMemoryEvents with source: "device".
 *
 * Awards 20 pts via WEARABLE_SYNC gamification event (once per week).
 *
 * Flag: wearable_sync
 * Consent: "health_memory" purpose required
 */

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db/client";
import { healthMemoryEvents } from "@/db/schema";
import { requirePatientSession } from "@/lib/core/patient-session";
import { requireFeatureFlag } from "@/lib/config/feature-flags";
import { withErrorHandler, AppError } from "@/lib/errors/app-error";
import { encryptPHI } from "@/lib/health/encryption";
import { awardPoints } from "@/lib/gamification/award";

// ── Types ──────────────────────────────────────────────────────────────────────

interface HealthDataPoint {
  type: "steps" | "heart_rate" | "blood_glucose" | "weight" | "sleep" | "blood_pressure" | "spo2";
  value: number | string;
  unit?: string;
  timestamp: string;  // ISO 8601
}

interface ParsedImport {
  source: "google_health" | "apple_health" | "generic";
  dataPoints: HealthDataPoint[];
}

// ── Parser ─────────────────────────────────────────────────────────────────────

function parseGoogleHealthExport(data: unknown): HealthDataPoint[] {
  const points: HealthDataPoint[] = [];
  if (!data || typeof data !== "object") return points;

  const root = data as Record<string, unknown>;
  // Google Health Connect export format: { "DataPoints": [...] }
  const raw = (root["DataPoints"] ?? root["dataPoints"] ?? root["data"] ?? []) as unknown[];
  if (!Array.isArray(raw)) return points;

  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    const d = item as Record<string, unknown>;
    const typeStr = String(d["dataTypeName"] ?? d["type"] ?? "").toLowerCase();
    const ts = String(d["startTime"] ?? d["timestamp"] ?? "");

    let type: HealthDataPoint["type"] | null = null;
    let value: number | string = 0;
    let unit: string | undefined;

    if (typeStr.includes("step")) {
      type = "steps";
      value = Number(d["count"] ?? d["value"] ?? 0);
      unit = "steps";
    } else if (typeStr.includes("heart") || typeStr.includes("bpm")) {
      type = "heart_rate";
      value = Number(d["bpm"] ?? d["value"] ?? 0);
      unit = "bpm";
    } else if (typeStr.includes("glucose")) {
      type = "blood_glucose";
      value = Number(d["level"] ?? d["value"] ?? 0);
      unit = "mg/dL";
    } else if (typeStr.includes("weight")) {
      type = "weight";
      value = Number(d["weight"] ?? d["value"] ?? 0);
      unit = "kg";
    } else if (typeStr.includes("sleep")) {
      type = "sleep";
      value = Number(d["durationMinutes"] ?? d["value"] ?? 0);
      unit = "minutes";
    }

    if (type && ts) {
      points.push({ type, value, unit, timestamp: ts });
    }
  }

  return points;
}

function parseAppleHealthExport(data: unknown): HealthDataPoint[] {
  const points: HealthDataPoint[] = [];
  if (!data || typeof data !== "object") return points;

  // Apple Health JSON export format: { "data": { "metrics": [...] } }
  const root = data as Record<string, unknown>;
  const metrics = (root["data"] as Record<string, unknown> | undefined)?.["metrics"] as unknown[] ?? [];

  for (const metric of metrics) {
    if (!metric || typeof metric !== "object") continue;
    const m = metric as Record<string, unknown>;
    const name = String(m["name"] ?? "").toLowerCase();
    const dataArr = (m["data"] as unknown[]) ?? [];

    let type: HealthDataPoint["type"] | null = null;
    if (name.includes("step")) type = "steps";
    else if (name.includes("heart")) type = "heart_rate";
    else if (name.includes("glucose")) type = "blood_glucose";
    else if (name.includes("weight")) type = "weight";
    else if (name.includes("sleep")) type = "sleep";

    if (!type) continue;

    for (const dp of dataArr) {
      if (!dp || typeof dp !== "object") continue;
      const d = dp as Record<string, unknown>;
      const ts = String(d["date"] ?? "");
      const value = Number(d["qty"] ?? d["value"] ?? 0);
      if (ts) points.push({ type, value, timestamp: ts });
    }
  }

  return points;
}

function parseImport(body: unknown): ParsedImport {
  if (!body || typeof body !== "object") {
    throw new Error("Invalid import data");
  }

  const root = body as Record<string, unknown>;

  // Detect format
  if (root["DataPoints"] || root["dataPoints"]) {
    return { source: "google_health", dataPoints: parseGoogleHealthExport(body) };
  }
  if ((root["data"] as Record<string, unknown>)?.["metrics"]) {
    return { source: "apple_health", dataPoints: parseAppleHealthExport(body) };
  }
  // Generic format: { data: HealthDataPoint[] }
  if (Array.isArray(root["data"])) {
    const points = (root["data"] as unknown[])
      .filter((d) => d && typeof d === "object" && (d as Record<string, unknown>)["type"])
      .map((d) => d as HealthDataPoint);
    return { source: "generic", dataPoints: points };
  }

  return { source: "generic", dataPoints: [] };
}

// ── Map data point type → health memory event type ────────────────────────────

function mapEventType(dpType: HealthDataPoint["type"]): string {
  switch (dpType) {
    case "steps":
    case "heart_rate":
    case "spo2":
    case "blood_pressure":
      return "vital";
    case "blood_glucose":
      return "lab_result";
    case "weight":
      return "vital";
    case "sleep":
      return "vital";
    default:
      return "vital";
  }
}

// ── Route handler ──────────────────────────────────────────────────────────────

export const POST = withErrorHandler(async (req: NextRequest) => {
  const flagCheck = await requireFeatureFlag("wearable_sync");
  if (flagCheck) return flagCheck;

  const session = await requirePatientSession(req);
  const { patientId } = session;

  const body = await req.json().catch(() => null);
  if (!body) {
    throw new AppError("VALIDATION_ERROR", "JSON body required", "Upload a valid JSON export file.", 400);
  }

  let parsed: ParsedImport;
  try {
    parsed = parseImport(body);
  } catch {
    throw new AppError("VALIDATION_ERROR", "Cannot parse file", "Unrecognised wearable export format.", 400);
  }

  if (parsed.dataPoints.length === 0) {
    return NextResponse.json({ imported: 0, source: parsed.source, message: "No recognised data points found in file." });
  }

  // Limit to 1000 points per import to avoid DB overload
  const toImport = parsed.dataPoints.slice(0, 1000);

  // Write health memory events in batches of 50
  const BATCH = 50;
  let imported = 0;
  for (let i = 0; i < toImport.length; i += BATCH) {
    const batch = toImport.slice(i, i + BATCH);
    const values = batch.map((dp) => {
      const data = { type: dp.type, value: dp.value, unit: dp.unit, deviceSource: parsed.source };
      return {
        patientId,
        source: "device" as const,
        eventType: mapEventType(dp.type),
        eventDate: new Date(dp.timestamp),
        dataEncrypted: encryptPHI(data),
        isActive: true,
      };
    }).filter((v) => !isNaN(v.eventDate.getTime())); // filter invalid dates

    if (values.length > 0) {
      await db.insert(healthMemoryEvents).values(values).onConflictDoNothing();
      imported += values.length;
    }
  }

  // Award gamification points — once per ISO week
  const isoWeek = (() => {
    const d = new Date();
    const day = d.getDay() || 7;
    d.setUTCDate(d.getUTCDate() + 4 - day);
    const yearStart = new Date(d.getUTCFullYear(), 0, 1);
    return `${d.getUTCFullYear()}-W${Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7)}`;
  })();

  void awardPoints({
    actorId: patientId,
    actorType: "patient",
    eventType: "WEARABLE_SYNC",
    proofId: `${patientId}:${isoWeek}`,
    proofType: "wearable_import",
  });

  return NextResponse.json({
    imported,
    source: parsed.source,
    total: parsed.dataPoints.length,
    message: `Imported ${imported} health data points from ${parsed.source}.`,
  });
});
