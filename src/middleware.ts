import { NextRequest, NextResponse } from "next/server";

import { SESSION_COOKIE } from "@/lib/session";

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  if (!pathname.startsWith("/admin") || pathname.startsWith("/admin/login")) {
    return NextResponse.next();
  }

  const session = req.cookies.get(SESSION_COOKIE)?.value;
  if (session) {
    return NextResponse.next();
  }

  const redirectUrl = new URL("/admin/login", req.url);
  return NextResponse.redirect(redirectUrl);
}

export const config = {
  matcher: ["/admin/:path*"],
};
