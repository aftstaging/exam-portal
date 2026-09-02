export function isAttemptEditable(status: string): boolean {
  return !["submitted", "awaiting_marking", "marked", "expired", "cancelled"].includes(status);
}

export function isAttemptSubmittable(status: string): boolean {
  return status === "in_progress";
}

export function hasActiveEntitlement(
  entitlement?: string | { status?: string; startsAt?: Date | string | null; expiresAt?: Date | string | null } | null,
  now = new Date(),
): boolean {
  if (!entitlement) return false;
  if (typeof entitlement === "string") return entitlement === "active";
  if (entitlement.status !== "active") return false;
  const startsAt = entitlement.startsAt ? new Date(entitlement.startsAt).getTime() : Number.NEGATIVE_INFINITY;
  const expiresAt = entitlement.expiresAt ? new Date(entitlement.expiresAt).getTime() : Number.POSITIVE_INFINITY;
  const timestamp = now.getTime();
  return timestamp >= startsAt && timestamp < expiresAt;
}

export function isAdminRole(role: string | undefined): boolean {
  return role === "admin";
}
