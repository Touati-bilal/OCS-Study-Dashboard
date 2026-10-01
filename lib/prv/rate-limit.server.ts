/**
 * In-memory rate limiting for the two unauthenticated entry points: the owner login and the PRV
 * 4-digit code.
 *
 * The persistent attempt counters in `auth.server.ts` are the durable defence - they survive a
 * restart and are what actually locks the account. This is the second, cheaper layer in front of
 * them: it absorbs a burst of attempts within a single process before they ever reach the scrypt
 * verification, so a rapid script cannot burn CPU on password or code guesses, and it caps how fast
 * one client can try at all.
 *
 * The map is bounded and entries expire, so it cannot grow without limit. It is per-process, which
 * is the right scope here: the app is documented as a single Node process, and the persistent
 * counters remain the authoritative lock.
 */
import "server-only";

interface Bucket {
  /** Timestamps of the accepted attempts still inside the window. */
  hits: number[];
}

const buckets = new Map<string, Bucket>();

/** How often expired buckets are swept, in attempts. */
const SWEEP_EVERY = 200;
let attemptsSinceSweep = 0;

function sweep(now: number, windowMs: number) {
  attemptsSinceSweep += 1;
  if (attemptsSinceSweep < SWEEP_EVERY) return;
  attemptsSinceSweep = 0;
  for (const [key, bucket] of buckets) {
    bucket.hits = bucket.hits.filter((t) => now - t < windowMs);
    if (bucket.hits.length === 0) buckets.delete(key);
  }
}

export interface RateLimitDecision {
  allowed: boolean;
  /** Milliseconds until the next attempt would be accepted. */
  retryAfterMs: number;
  /** Attempts left in the current window, for a `Retry-After`-style response header. */
  remaining: number;
}

/**
 * Registers one attempt against `key` and reports whether it is allowed.
 *
 * A rejected attempt is *not* recorded, so a client that keeps hammering cannot push its own window
 * further out than the wall clock allows.
 */
export function consumeRateLimit(key: string, limit: number, windowMs: number): RateLimitDecision {
  const now = Date.now();
  sweep(now, windowMs);

  const bucket = buckets.get(key) ?? { hits: [] };
  bucket.hits = bucket.hits.filter((t) => now - t < windowMs);

  if (bucket.hits.length >= limit) {
    buckets.set(key, bucket);
    const oldest = bucket.hits[0];
    return {
      allowed: false,
      retryAfterMs: Math.max(0, windowMs - (now - oldest)),
      remaining: 0,
    };
  }

  bucket.hits.push(now);
  buckets.set(key, bucket);
  return { allowed: true, retryAfterMs: 0, remaining: limit - bucket.hits.length };
}

/**
 * A stable key for one client.
 *
 * `x-forwarded-for` is only honoured when the app actually runs behind a proxy that sets it, so a
 * direct client cannot rotate its identity by sending the header itself.
 */
export function clientKey(request: Request, scope: string): string {
  // Both forwarding headers are attacker-controlled unless the app really sits behind a proxy that
  // overwrites them. `x-real-ip` used to be read unconditionally, which let anyone reset their own
  // bucket on every request and walk straight through the limiter by rotating that one header.
  const trustProxy = process.env.PRV_TRUST_PROXY === "1";
  const forwarded = trustProxy ? request.headers.get("x-forwarded-for") : null;
  const realIp = trustProxy ? request.headers.get("x-real-ip") : null;
  const ip =
    forwarded?.split(",")[0]?.trim() ||
    realIp?.trim() ||
    // `request.ip` is not populated in the App Router; the socket address is not reachable either,
    // so an absent address falls back to a single shared bucket. That is stricter, not looser.
    "local";
  return `${scope}:${ip}`;
}

/** Test-only: forget every bucket. */
export function __resetRateLimitsForTests(): void {
  buckets.clear();
  attemptsSinceSweep = 0;
}
