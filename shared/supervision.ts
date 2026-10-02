import { hasActiveEntitlement } from "./integrity";

type EntitlementLike =
  | { status?: string; startsAt?: Date | string | null; expiresAt?: Date | string | null }
  | string
  | null
  | undefined;

/**
 * A learner counts as enrolled/subscribed when at least one entitlement is
 * currently active. Admin-allocation and subscription rows both qualify, so
 * supervision is offered for either path.
 */
export function countActiveEntitlements(entitlements: EntitlementLike[], now = new Date()): number {
  return entitlements.filter((entitlement) => hasActiveEntitlement(entitlement, now)).length;
}

export function isEnrolled(entitlements: EntitlementLike[], now = new Date()): boolean {
  return countActiveEntitlements(entitlements, now) > 0;
}

export function isSupervisionActive(status: string | null | undefined): boolean {
  return status === "active";
}
