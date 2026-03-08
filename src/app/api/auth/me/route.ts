import { NextRequest, NextResponse } from "next/server";

import { requireAuth } from "@/lib/auth";

export async function GET(req: NextRequest) {
  const auth = await requireAuth(req);

  if (auth instanceof NextResponse) {
    return auth;
  }

  return NextResponse.json({ data: auth });
}
