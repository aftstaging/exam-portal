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

/**
 * Turns the coupon expiry an administrator typed into the instant the coupon stops working.
 * Blank input means "never expires". A bare date (`2027-01-31`) means "valid through that day".
 * A date-time set to exactly midnight is also treated as "the whole of that day", matching what
 * people mean when they pick an expiry day in the admin form.
 */
export function couponExpiryFromInput(input?: string | null, now = new Date()): Date | null {
  if (!input) return null;
  const trimmed = input.trim();
  if (!trimmed) return null;
  const mustBeFuture = (expiry: Date) => {
    if (expiry.getTime() + 60_000 < now.getTime()) throw new Error("Coupon expiry must be in the future");
    return expiry;
  };
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    const expiry = new Date(`${trimmed}T23:59:59.999Z`);
    if (Number.isNaN(expiry.getTime())) throw new Error("Coupon expiry must be a valid date and time");
    return mustBeFuture(expiry);
  }
  const parsed = new Date(trimmed);
  if (Number.isNaN(parsed.getTime())) throw new Error("Coupon expiry must be a valid date and time");
  const atMidnight = parsed.getHours() === 0 && parsed.getMinutes() === 0 && parsed.getSeconds() === 0;
  const expiry = atMidnight ? new Date(parsed.getTime() + 24 * 60 * 60 * 1000 - 1) : parsed;
  return mustBeFuture(expiry);
}
