import { NextRequest } from "next/server";

export type AuthContext = {
  userId: string;
  role: "owner" | "admin" | "advisor" | "viewer";
};

export function getAuthContext(req: NextRequest): AuthContext {
  const userId = req.headers.get("x-user-id") ?? "system-local";
  const roleHeader = req.headers.get("x-user-role") ?? "admin";

  const role = ["owner", "admin", "advisor", "viewer"].includes(roleHeader)
    ? (roleHeader as AuthContext["role"])
    : "viewer";

  return { userId, role };
}
