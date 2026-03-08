import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json({
    status: "ok",
    service: "easyheals-next",
    timestamp: new Date().toISOString(),
  });
}
