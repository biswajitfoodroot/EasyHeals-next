import { NextResponse } from "next/server";

import type { RoleCode } from "@/lib/auth";

export function ensureRole(role: RoleCode, allowedRoles: RoleCode[]) {
  if (allowedRoles.includes(role)) {
    return null;
  }

  return NextResponse.json(
    {
      error: "Forbidden",
      code: "RBAC_FORBIDDEN",
      message: `Role ${role} cannot perform this action`,
    },
    { status: 403 },
  );
}
