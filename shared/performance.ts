/**
 * Pure performance and profile helpers shared by the learner profile, the instructor dashboard and
 * the tests. No database or I/O lives here, so every rule can be checked in isolation.
 */

export const PASS_MARK_PERCENT = 50;

/** Percentage of available marks awarded, rounded to one decimal place, or null when unmarked. */
export function scorePercent(awarded: number, total: number): number | null {
  if (!Number.isFinite(awarded) || !Number.isFinite(total) || total <= 0) return null;
  return Math.round((Math.max(0, awarded) / total) * 1000) / 10;
}

export type ScoredItem = { percent: number | null; date?: Date | string | null };

export type PerformanceSummary = {
  submitted: number;
  marked: number;
  awaitingMarking: number;
  averagePercent: number | null;
  bestPercent: number | null;
  latestPercent: number | null;
  passRate: number | null;
  /** Scores in chronological order, for a trend chart. */
  trend: { date: string | null; percent: number }[];
};

/** Aggregates a learner's submissions into the figures shown on profile and instructor dashboards. */
export function summarizePerformance(items: { submitted: boolean; awaitingMarking: boolean; percent: number | null; date?: Date | string | null }[]): PerformanceSummary {
  const submitted = items.filter((item) => item.submitted).length;
  const awaitingMarking = items.filter((item) => item.awaitingMarking).length;
  const scored = items
    .filter((item): item is { submitted: boolean; awaitingMarking: boolean; percent: number; date?: Date | string | null } => item.percent != null)
    .map((item) => ({ percent: item.percent, date: item.date ?? null }))
    .sort((a, b) => toTime(a.date) - toTime(b.date));
  const average = scored.length ? round1(scored.reduce((sum, item) => sum + item.percent, 0) / scored.length) : null;
  const passed = scored.filter((item) => item.percent >= PASS_MARK_PERCENT).length;
  return {
    submitted,
    marked: scored.length,
    awaitingMarking,
    averagePercent: average,
    bestPercent: scored.length ? Math.max(...scored.map((item) => item.percent)) : null,
    latestPercent: scored.length ? scored[scored.length - 1]!.percent : null,
    passRate: scored.length ? Math.round((passed / scored.length) * 100) : null,
    trend: scored.map((item) => ({ date: item.date ? new Date(item.date).toISOString() : null, percent: item.percent })),
  };
}

function toTime(value: Date | string | null | undefined): number {
  if (!value) return 0;
  const time = new Date(value).getTime();
  return Number.isNaN(time) ? 0 : time;
}

function round1(value: number): number {
  return Math.round(value * 10) / 10;
}

/** The plain-language status a learner or instructor sees for one submission. */
export function submissionStatusLabel(attemptStatus: string, markingStatus: string | null | undefined, optedOut: boolean): string {
  if (attemptStatus === "in_progress" || attemptStatus === "not_started") return "In progress";
  if (attemptStatus === "expired") return "Expired";
  if (attemptStatus === "cancelled") return "Cancelled";
  if (markingStatus === "submitted" || attemptStatus === "marked") return "Marked";
  if (optedOut) return "Submitted (no marking requested)";
  if (markingStatus === "assigned" || markingStatus === "in_progress") return "Being marked";
  return "Awaiting marking";
}

export const PROFILE_LIMITS = {
  name: 200,
  bio: 2000,
  phone: 40,
  headline: 160,
  employer: 200,
  city: 120,
  country: 120,
  linkedinUrl: 400,
  targetQualification: 200,
  emergencyContactName: 200,
  emergencyContactPhone: 40,
} as const;

export type ProfileInput = {
  name?: string;
  bio?: string | null;
  phone?: string | null;
  headline?: string | null;
  employer?: string | null;
  city?: string | null;
  country?: string | null;
  dateOfBirth?: string | null;
  linkedinUrl?: string | null;
  targetQualification?: string | null;
  emergencyContactName?: string | null;
  emergencyContactPhone?: string | null;
};

/** Trims text fields and turns blanks into null, so an empty form field clears the stored value. */
export function normalizeProfileInput(input: ProfileInput): ProfileInput {
  const clean = (value: string | null | undefined) => {
    if (value === undefined) return undefined;
    const trimmed = (value ?? "").trim();
    return trimmed.length ? trimmed : null;
  };
  return {
    name: input.name === undefined ? undefined : (input.name ?? "").trim(),
    bio: clean(input.bio),
    phone: clean(input.phone),
    headline: clean(input.headline),
    employer: clean(input.employer),
    city: clean(input.city),
    country: clean(input.country),
    dateOfBirth: clean(input.dateOfBirth),
    linkedinUrl: clean(input.linkedinUrl),
    targetQualification: clean(input.targetQualification),
    emergencyContactName: clean(input.emergencyContactName),
    emergencyContactPhone: clean(input.emergencyContactPhone),
  };
}

const PHONE_PATTERN = /^\+?[0-9(][0-9 ()-]{4,38}[0-9]$/;

export function isValidPhone(value: string | null | undefined): boolean {
  if (!value) return true;
  return PHONE_PATTERN.test(value.trim());
}

export function isValidDateOfBirth(value: string | null | undefined): boolean {
  if (!value) return true;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  if (Number.isNaN(date.getTime())) return false;
  return date.toISOString().startsWith(value) && date.getTime() < Date.now();
}

export function isValidHttpsUrl(value: string | null | undefined): boolean {
  if (!value) return true;
  try {
    return new URL(value).protocol === "https:";
  } catch {
    return false;
  }
}

export const AVATAR_MIME_TYPES: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/webp": "webp",
  "image/gif": "gif",
};
export const AVATAR_MAX_BYTES = 5 * 1024 * 1024;

/** True when the first bytes of a file match the image format the browser claims it is. */
export function matchesImageSignature(bytes: Uint8Array, mimeType: string): boolean {
  const at = (index: number, value: number) => bytes[index] === value;
  switch (mimeType) {
    case "image/png":
      return at(0, 0x89) && at(1, 0x50) && at(2, 0x4e) && at(3, 0x47);
    case "image/jpeg":
      return at(0, 0xff) && at(1, 0xd8) && at(2, 0xff);
    case "image/gif":
      return at(0, 0x47) && at(1, 0x49) && at(2, 0x46);
    case "image/webp":
      return at(0, 0x52) && at(1, 0x49) && at(2, 0x46) && at(3, 0x46) && at(8, 0x57) && at(9, 0x45) && at(10, 0x42) && at(11, 0x50);
    default:
      return false;
  }
}
