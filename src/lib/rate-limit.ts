import { createHash } from "crypto"
import { NextResponse } from "next/server"
import { prisma } from "./prisma"

/**
 * Fixed-window rate limiting for the auth routes, backed by the `RateLimit`
 * table so every serverless instance shares one counter per key (an
 * in-memory Map only ever sees the requests that landed on its own instance).
 *
 * Each check is a single atomic upsert: a new key starts at 1, an expired
 * window resets to 1, otherwise the count increments. If the database call
 * fails the request is allowed (fail open) so a DB blip never locks every
 * user out of logging in.
 */

export interface RateLimitRule {
  /** Namespace for the key, e.g. "login:email". */
  name: string
  /** Requests allowed per window. */
  limit: number
  windowMs: number
}

export interface RateLimitResult {
  allowed: boolean
  limit: number
  remaining: number
  resetAt: Date
  /** Whole seconds until the window resets (0 when allowed). */
  retryAfterSeconds: number
}

const MINUTE = 60 * 1000
const HOUR = 60 * MINUTE

// Conservative limits: high enough that a real user (or a household / venue
// wifi / carrier NAT sharing one IP) never notices, low enough to stop
// password guessing and email bombing. Login limits allow for
// signInWithRetry() in src/lib/auth-client.ts, which can call authorize twice
// per failed attempt.
export const RATE_LIMITS = {
  loginEmail: { name: "login:email", limit: 20, windowMs: 15 * MINUTE },
  loginIp: { name: "login:ip", limit: 100, windowMs: 15 * MINUTE },
  registerIp: { name: "register:ip", limit: 20, windowMs: HOUR },
  forgotPasswordEmail: {
    name: "forgot-password:email",
    limit: 5,
    windowMs: HOUR,
  },
  forgotPasswordIp: { name: "forgot-password:ip", limit: 20, windowMs: HOUR },
  resendVerificationEmail: {
    name: "resend-verification:email",
    limit: 5,
    windowMs: HOUR,
  },
  resendVerificationIp: {
    name: "resend-verification:ip",
    limit: 20,
    windowMs: HOUR,
  },
  resetPasswordIp: { name: "reset-password:ip", limit: 20, windowMs: HOUR },
} as const satisfies Record<string, RateLimitRule>

/**
 * `RATE_LIMIT_DISABLED=true` turns limiting off for the e2e suite (set in
 * playwright.config.ts), where many tests register and log in from one IP
 * against one shared database. Ignored on Vercel production so a stray env
 * var can never switch it off for real users.
 */
export function isRateLimitDisabled(): boolean {
  return (
    process.env.RATE_LIMIT_DISABLED === "true" &&
    process.env.VERCEL_ENV !== "production"
  )
}

/**
 * The client IP as Vercel reports it. Vercel overwrites `x-forwarded-for`
 * with the real client IP (so it can't be spoofed there) and also sets
 * `x-real-ip`; behind other proxies the first `x-forwarded-for` hop is the
 * client.
 */
export function getClientIp(headers: Headers): string {
  const forwarded = headers.get("x-forwarded-for")?.split(",")[0]?.trim()
  return forwarded || headers.get("x-real-ip")?.trim() || "unknown"
}

/** Normalizes an email for use as a rate-limit identifier. */
export function normalizeEmailKey(email: string): string {
  return email.trim().toLowerCase()
}

// Identifiers (emails, IPs) are hashed so the table never stores them raw.
function buildKey(rule: RateLimitRule, identifier: string): string {
  const digest = createHash("sha256").update(identifier).digest("hex")
  return `${rule.name}:${digest}`
}

// Roughly 1 in 100 checks also deletes long-expired rows, which keeps the
// table small without needing a dedicated cron.
const CLEANUP_PROBABILITY = 0.01
const CLEANUP_GRACE_MS = HOUR

function maybeCleanup(now: Date): void {
  if (Math.random() >= CLEANUP_PROBABILITY) return
  const cutoff = new Date(now.getTime() - CLEANUP_GRACE_MS)
  Promise.resolve(
    prisma.rateLimit.deleteMany({ where: { resetAt: { lt: cutoff } } })
  ).catch((error: unknown) => {
    console.warn("[RateLimit] Failed to clean up expired rows:", error)
  })
}

function allowAll(rule: RateLimitRule, now: Date): RateLimitResult {
  return {
    allowed: true,
    limit: rule.limit,
    remaining: rule.limit,
    resetAt: new Date(now.getTime() + rule.windowMs),
    retryAfterSeconds: 0,
  }
}

/** Counts one request against `rule` for `identifier`. */
export async function checkRateLimit(
  rule: RateLimitRule,
  identifier: string
): Promise<RateLimitResult> {
  const now = new Date()
  if (isRateLimitDisabled()) return allowAll(rule, now)

  const key = buildKey(rule, identifier)
  const windowEnd = new Date(now.getTime() + rule.windowMs)

  try {
    const rows = await prisma.$queryRaw<{ count: number; resetAt: Date }[]>`
      INSERT INTO "RateLimit" ("key", "count", "resetAt")
      VALUES (${key}, 1, ${windowEnd})
      ON CONFLICT ("key") DO UPDATE SET
        "count" = CASE
          WHEN "RateLimit"."resetAt" <= ${now} THEN 1
          ELSE "RateLimit"."count" + 1
        END,
        "resetAt" = CASE
          WHEN "RateLimit"."resetAt" <= ${now} THEN EXCLUDED."resetAt"
          ELSE "RateLimit"."resetAt"
        END
      RETURNING "count", "resetAt"
    `
    const row = rows?.[0]
    if (!row) throw new Error("rate limit upsert returned no row")

    maybeCleanup(now)

    const count = Number(row.count)
    const resetAt = new Date(row.resetAt)
    const allowed = count <= rule.limit
    return {
      allowed,
      limit: rule.limit,
      remaining: Math.max(0, rule.limit - count),
      resetAt,
      retryAfterSeconds: allowed
        ? 0
        : Math.max(1, Math.ceil((resetAt.getTime() - now.getTime()) / 1000)),
    }
  } catch (error) {
    console.warn(
      `[RateLimit] Check failed for ${rule.name}, allowing request:`,
      error
    )
    return allowAll(rule, now)
  }
}

/**
 * Counts one request against every rule and returns the most restrictive
 * result: blocked if any rule is exceeded, with the longest Retry-After.
 */
export async function checkRateLimits(
  checks: [RateLimitRule, string][]
): Promise<RateLimitResult> {
  const results = await Promise.all(
    checks.map(([rule, identifier]) => checkRateLimit(rule, identifier))
  )
  const blocked = results.filter((r) => !r.allowed)
  if (blocked.length > 0) {
    return blocked.reduce((a, b) =>
      b.retryAfterSeconds > a.retryAfterSeconds ? b : a
    )
  }
  return results.reduce((a, b) => (b.remaining < a.remaining ? b : a))
}

/** The 429 response API routes return when a limit is exceeded. */
export function rateLimitResponse(
  result: RateLimitResult,
  error = "Too many requests. Please try again later."
): NextResponse {
  return NextResponse.json(
    { error },
    {
      status: 429,
      headers: { "Retry-After": String(result.retryAfterSeconds) },
    }
  )
}
