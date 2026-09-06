import { getConnInfo } from "@hono/node-server/conninfo";
import type { Context, MiddlewareHandler } from "hono";
import { env } from "../env.js";
import { HttpError } from "./errors.js";

/**
 * Fixed-window rate limiting, keyed by client IP (OQ-2).
 *
 * There is no end-user login (D-01), so an IP address is the only handle we
 * have on a caller, and this is the only thing standing between a stranger and
 * an unbounded Gemini bill. It must exist before the service is public.
 *
 * State lives in this process. That is honest for how the API runs today — one
 * Node process — and deliberately not more: deployment is still undecided
 * (OQ-4), and building a distributed limiter against an unknown runtime would
 * be guessing. Run more than one instance and each enforces its own share, so
 * the effective limit multiplies by the instance count. Move the counters to
 * Postgres or the platform's own limiter before scaling out.
 *
 * A fixed window rather than a sliding one, because the failure mode is mild:
 * a caller who times it right gets up to 2x the limit across a window
 * boundary. For a cost control on a public read API that is an acceptable
 * trade for keeping the whole thing in one map.
 */

export interface RateLimitRule {
  limit: number;
  windowMs: number;
}

interface Window {
  count: number;
  resetAt: number;
}

const windows = new Map<string, Window>();

/**
 * Sweeping only on write keeps the map from growing without bound while a
 * process runs, without a timer holding the event loop open. The threshold
 * exists so a busy server does not walk the whole map on every request.
 */
const SWEEP_THRESHOLD = 10_000;

function sweep(now: number): void {
  for (const [key, window] of windows) {
    if (window.resetAt <= now) windows.delete(key);
  }
}

/**
 * Middleware enforcing `rule` against a named bucket.
 *
 * Routes sharing a bucket name share a budget, which is how /v1/overview and
 * /v1/brief are limited together: they cost the same thing, so spending the
 * allowance on either should cost the same.
 */
export function rateLimit(
  bucket: string,
  rule: RateLimitRule,
): MiddlewareHandler {
  return async (c, next) => {
    const now = Date.now();
    const key = `${bucket}:${clientKey(c)}`;

    if (windows.size > SWEEP_THRESHOLD) sweep(now);

    let window = windows.get(key);
    if (!window || window.resetAt <= now) {
      window = { count: 0, resetAt: now + rule.windowMs };
      windows.set(key, window);
    }
    window.count++;

    const remaining = Math.max(0, rule.limit - window.count);
    const resetSeconds = Math.ceil((window.resetAt - now) / 1000);

    // Draft-standard headers, so a client can back off before being refused
    // rather than only learning about the limit by hitting it.
    c.header("RateLimit-Limit", String(rule.limit));
    c.header("RateLimit-Remaining", String(remaining));
    c.header("RateLimit-Reset", String(resetSeconds));

    if (window.count > rule.limit) {
      c.header("Retry-After", String(resetSeconds));
      throw new HttpError(
        "rate_limited",
        `Rate limit reached: ${rule.limit} requests per ${describeWindow(rule.windowMs)}. Try again in ${resetSeconds}s.`,
      );
    }

    await next();
  };
}

function describeWindow(windowMs: number): string {
  const minutes = Math.round(windowMs / 60_000);
  return minutes === 1 ? "minute" : `${minutes} minutes`;
}

/** Exported for tests: the limiter is process state and does not reset itself. */
export function resetRateLimits(): void {
  windows.clear();
}

/**
 * The caller's address.
 *
 * X-Forwarded-For is only believed when TRUST_PROXY is set, because a header
 * anyone can send is a bypass, not an identity: without a proxy in front of
 * us, trusting it would let a caller rotate their own limit key at will. With
 * one in front of us, ignoring it would put every caller in the same bucket.
 * Neither default is safe for both deployments, so it is a deliberate switch.
 *
 * When no address can be determined at all, everyone anonymous shares one
 * bucket. That is the conservative direction to fail in.
 */
function clientKey(c: Context): string {
  if (env.trustProxy) {
    const forwarded = c.req.header("x-forwarded-for");
    // Left-most entry is the original client; the rest were added by hops.
    const client = forwarded?.split(",")[0]?.trim();
    if (client) return client;
  }

  return getConnInfo(c).remote.address ?? "unknown";
}
