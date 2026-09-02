export function shouldGrantPurchasedEntitlement(hasActiveEntitlement: boolean): boolean {
  return !hasActiveEntitlement;
}

export function entitlementExpiryFromAccessDays(accessDays: number | null | undefined, startsAt = new Date()): Date | null {
  const days = Number(accessDays ?? 30);
  if (!Number.isFinite(days) || days <= 0) return null;
  return new Date(startsAt.getTime() + days * 24 * 60 * 60 * 1000);
}

export function subscriptionDaysRemaining(expiresAt: Date | string | null | undefined, now = new Date()): number | null {
  if (!expiresAt) return null;
  return Math.max(0, Math.ceil((new Date(expiresAt).getTime() - now.getTime()) / (24 * 60 * 60 * 1000)));
}
