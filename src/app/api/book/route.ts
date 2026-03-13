import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { db } from "@/db/client";
import { leads } from "@/db/schema";

const bookingSchema = z.object({
  fullName: z.string().min(2).max(120),
  phone: z.string().min(6).max(20),
  email: z.string().email().optional(),
  city: z.string().max(80).optional(),
  medicalSummary: z.string().max(2000).optional(),
  hospitalId: z.string().optional(),
  doctorName: z.string().max(150).optional(),
  source: z.string().max(60).default("web_booking"),
});

// Public endpoint — no auth required (patient-facing booking funnel)
export async function POST(req: NextRequest) {
  const payload = await req.json().catch(() => null);
  if (!payload) {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const parsed = bookingSchema.safeParse(payload);
  if (!parsed.success) {
    return NextResponse.json({ error: "Validation error", details: parsed.error.flatten() }, { status: 400 });
  }

  const [lead] = await db
    .insert(leads)
    .values({
      fullName: parsed.data.fullName,
      phone: parsed.data.phone,
      email: parsed.data.email,
      city: parsed.data.city,
      source: parsed.data.source,
      medicalSummary: parsed.data.medicalSummary,
      hospitalId: parsed.data.hospitalId,
      status: "new",
      score: 20,
    })
    .returning({ id: leads.id });

  return NextResponse.json({ data: { id: lead.id }, message: "Booking request received." }, { status: 201 });
}
