/**
 * A fixed-window rate limiter for sensitive endpoints such as sign-in and registration.
 *
 * Counters live in process memory, which matches the single-instance deployment (one Node process
 * behind nginx). If the app is ever scaled out, move the buckets to a shared store such as Redis,
 * otherwise each instance enforces its own limit.
 */
export type RateLimiter = {
  /** True when the key has used up its allowance in the current window. */
  isLimited(key: string): boolean;
  /** Records one attempt against the key. */
  hit(key: string): void;
  /** Clears the key, e.g. after a successful sign-in. */
  reset(key: string): void;
};

const MAX_TRACKED_KEYS = 50_000;

export function createRateLimiter(options: { windowMs: number; max: number }): RateLimiter {
  const buckets = new Map<string, { count: number; resetAt: number }>();

  const sweep = (now: number) => {
    buckets.forEach((bucket, key) => {
      if (bucket.resetAt <= now) buckets.delete(key);
    });
    // A flood of distinct keys must not grow memory without limit: drop the oldest when full.
    const excess = buckets.size - MAX_TRACKED_KEYS;
    let dropped = 0;
    buckets.forEach((_bucket, key) => {
      if (dropped < excess) {
        buckets.delete(key);
        dropped += 1;
      }
    });
  };

  return {
    isLimited(key) {
      const bucket = buckets.get(key);
      if (!bucket || bucket.resetAt <= Date.now()) return false;
      return bucket.count >= options.max;
    },
    hit(key) {
      const now = Date.now();
      let bucket = buckets.get(key);
      if (!bucket || bucket.resetAt <= now) {
        bucket = { count: 0, resetAt: now + options.windowMs };
        buckets.set(key, bucket);
      }
      bucket.count += 1;
      if (buckets.size > MAX_TRACKED_KEYS) sweep(now);
    },
    reset(key) {
      buckets.delete(key);
    },
  };
}
