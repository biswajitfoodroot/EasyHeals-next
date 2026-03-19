/**
 * PHI Redactor — strips personally identifiable / protected health info
 * from objects before they reach logs, Sentry, or external systems.
 *
 * Covers DPDP-sensitive fields: phone, email, name, dob, aadhaar, pan,
 * plus their common snake_case / camelCase variants.
 */

const PHI_KEYS = new Set([
  "phone",
  "phone_hash",
  "phoneHash",
  "mobile",
  "mobileNumber",
  "mobile_number",
  "fullName",
  "full_name",
  "firstName",
  "first_name",
  "lastName",
  "last_name",
  "name",
  "email",
  "emailAddress",
  "email_address",
  "dob",
  "dateOfBirth",
  "date_of_birth",
  "aadhaar",
  "aadhaarNumber",
  "aadhaar_number",
  "pan",
  "panNumber",
  "pan_number",
  "address",
  "streetAddress",
  "street_address",
  "ipAddress",
  "ip_address",
  "ip",
]);

/**
 * Recursively redacts PHI keys from an object/error before logging or Sentry.
 * Safe to call with any value (non-objects are returned as-is).
 */
export function phiRedact(value: unknown, depth = 0): unknown {
  if (depth > 10) return "[max depth]";
  if (value === null || value === undefined) return value;
  if (value instanceof Error) {
    return {
      name: value.name,
      message: value.message,
      stack: value.stack,
    };
  }
  if (Array.isArray(value)) {
    return value.map((item) => phiRedact(item, depth + 1));
  }
  if (typeof value === "object") {
    const redacted: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      redacted[k] = PHI_KEYS.has(k) ? "[redacted]" : phiRedact(v, depth + 1);
    }
    return redacted;
  }
  return value;
}

/**
 * Strips PHI keys from a flat changes object (for audit logs).
 * Returns undefined if input is not a plain object.
 */
export function phiSafeChanges(
  changes: unknown,
): Record<string, unknown> | undefined {
  if (!changes || typeof changes !== "object" || Array.isArray(changes))
    return undefined;
  const safe: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(
    changes as Record<string, unknown>,
  )) {
    safe[key] = PHI_KEYS.has(key) ? "[redacted]" : value;
  }
  return safe;
}
