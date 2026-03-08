import { NextResponse } from "next/server";

import type { AuthContext } from "@/lib/auth";

export function ensureRole(auth: AuthContext, allowedRoles: AuthContext["role"][]) {
  if (allowedRoles.includes(auth.role)) {
    return null;
  }

  return NextResponse.json(
    {
      error: "Forbidden",
      code: "RBAC_FORBIDDEN",
      message: `Role ${auth.role} cannot perform this action`,
    },
    { status: 403 },
  );
}
