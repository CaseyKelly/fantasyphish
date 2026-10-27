import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"

vi.mock("./prisma", async () => {
  const { createPrismaMock } = await import("@/test-utils/prisma-mock")
  return { prisma: createPrismaMock() }
})

import { prisma } from "./prisma"
import { resetPrismaMock, type PrismaMock } from "@/test-utils/prisma-mock"
import {
  checkRateLimit,
  checkRateLimits,
  getClientIp,
  isRateLimitDisabled,
  normalizeEmailKey,
  rateLimitResponse,
  type RateLimitRule,
} from "./rate-limit"

const db = prisma as unknown as PrismaMock
const rule: RateLimitRule = { name: "test", limit: 3, windowMs: 60_000 }
const NOW = new Date("2026-10-25T12:00:00.000Z")

function row(count: number, resetAt = new Date(NOW.getTime() + 30_000)) {
  return [{ count, resetAt }]
}

// $queryRaw is a tagged template: calls are (strings, ...values)
function sqlOf(call: unknown[]): string {
  return (call[0] as TemplateStringsArray).join("?")
}

beforeEach(() => {
  resetPrismaMock(db)
  vi.useFakeTimers()
  vi.setSystemTime(NOW)
  vi.spyOn(Math, "random").mockReturnValue(0.5) // no cleanup by default
  vi.spyOn(console, "warn").mockImplementation(() => {})
  vi.unstubAllEnvs()
})

afterEach(() => {
  vi.useRealTimers()
  vi.restoreAllMocks()
  vi.unstubAllEnvs()
})

describe("checkRateLimit", () => {
  it("runs one atomic upsert that resets expired windows", async () => {
    db.$queryRaw.mockResolvedValue(row(1))
    await checkRateLimit(rule, "a@b.com")

    expect(db.$queryRaw).toHaveBeenCalledTimes(1)
    const call = db.$queryRaw.mock.calls[0]
    const sql = sqlOf(call)
    expect(sql).toContain('INSERT INTO "RateLimit"')
    expect(sql).toContain('ON CONFLICT ("key") DO UPDATE')
    expect(sql).toContain('"RateLimit"."count" + 1')
    expect(sql).toContain("RETURNING")
    const [key, windowEnd, now] = call.slice(1)
    // Identifier is hashed, namespaced by rule
    expect(key).toMatch(/^test:[0-9a-f]{64}$/)
    expect(key).not.toContain("a@b.com")
    expect(windowEnd).toEqual(new Date(NOW.getTime() + 60_000))
    expect(now).toEqual(NOW)
  })

  it("gives the same identifier the same key and others a different one", async () => {
    db.$queryRaw.mockResolvedValue(row(1))
    await checkRateLimit(rule, "x")
    await checkRateLimit(rule, "x")
    await checkRateLimit(rule, "y")
    await checkRateLimit({ ...rule, name: "other" }, "x")
    const keys = db.$queryRaw.mock.calls.map((c) => c[1])
    expect(keys[0]).toBe(keys[1])
    expect(keys[2]).not.toBe(keys[0])
    expect(keys[3]).not.toBe(keys[0])
  })

  it("allows up to the limit", async () => {
    db.$queryRaw.mockResolvedValue(row(3))
    expect(await checkRateLimit(rule, "x")).toMatchObject({
      allowed: true,
      remaining: 0,
      retryAfterSeconds: 0,
    })
  })

  it("blocks past the limit with a Retry-After until the window resets", async () => {
    db.$queryRaw.mockResolvedValue(row(4, new Date(NOW.getTime() + 29_500)))
    expect(await checkRateLimit(rule, "x")).toMatchObject({
      allowed: false,
      remaining: 0,
      retryAfterSeconds: 30,
    })
  })

  it("never reports a Retry-After below one second", async () => {
    db.$queryRaw.mockResolvedValue(row(9, NOW))
    expect((await checkRateLimit(rule, "x")).retryAfterSeconds).toBe(1)
  })

  it("fails open and warns when the database errors", async () => {
    db.$queryRaw.mockRejectedValue(new Error("db down"))
    const result = await checkRateLimit(rule, "x")
    expect(result.allowed).toBe(true)
    expect(console.warn).toHaveBeenCalled()
  })

  it("fails open when the upsert returns no row", async () => {
    db.$queryRaw.mockResolvedValue([])
    expect((await checkRateLimit(rule, "x")).allowed).toBe(true)
    expect(console.warn).toHaveBeenCalled()
  })

  it("skips the database when disabled outside production", async () => {
    vi.stubEnv("RATE_LIMIT_DISABLED", "true")
    expect(isRateLimitDisabled()).toBe(true)
    expect((await checkRateLimit(rule, "x")).allowed).toBe(true)
    expect(db.$queryRaw).not.toHaveBeenCalled()
  })

  it("ignores the disable flag on Vercel production", async () => {
    vi.stubEnv("RATE_LIMIT_DISABLED", "true")
    vi.stubEnv("VERCEL_ENV", "production")
    expect(isRateLimitDisabled()).toBe(false)
    db.$queryRaw.mockResolvedValue(row(4))
    expect((await checkRateLimit(rule, "x")).allowed).toBe(false)
  })

  it("occasionally deletes long-expired rows", async () => {
    vi.mocked(Math.random).mockReturnValue(0)
    db.$queryRaw.mockResolvedValue(row(1))
    db.rateLimit.deleteMany.mockResolvedValue({ count: 2 })
    await checkRateLimit(rule, "x")
    expect(db.rateLimit.deleteMany).toHaveBeenCalledWith({
      where: { resetAt: { lt: new Date(NOW.getTime() - 60 * 60 * 1000) } },
    })
  })

  it("does not fail the check when cleanup fails", async () => {
    vi.mocked(Math.random).mockReturnValue(0)
    db.$queryRaw.mockResolvedValue(row(1))
    db.rateLimit.deleteMany.mockRejectedValue(new Error("x"))
    expect((await checkRateLimit(rule, "x")).allowed).toBe(true)
    expect(console.warn).toHaveBeenCalled()
  })
})

describe("checkRateLimits", () => {
  it("finishes cleanup before the check returns", async () => {
    vi.mocked(Math.random).mockReturnValue(0)
    db.$queryRaw.mockResolvedValue(row(1))
    let finished = false
    db.rateLimit.deleteMany.mockImplementation(async () => {
      await Promise.resolve()
      finished = true
      return { count: 0 }
    })
    await checkRateLimit(rule, "x")
    expect(finished).toBe(true)
  })

  it("stops at the first exceeded rule without counting later ones", async () => {
    db.$queryRaw
      .mockResolvedValueOnce(row(1))
      .mockResolvedValueOnce(row(5, new Date(NOW.getTime() + 10_000)))
    const result = await checkRateLimits([
      [rule, "a"],
      [rule, "b"],
      [rule, "c"],
    ])
    expect(db.$queryRaw).toHaveBeenCalledTimes(2)
    expect(result).toMatchObject({ allowed: false, retryAfterSeconds: 10 })
  })

  it("returns the tightest remaining budget when all pass", async () => {
    db.$queryRaw.mockResolvedValueOnce(row(1)).mockResolvedValueOnce(row(2))
    const result = await checkRateLimits([
      [rule, "a"],
      [rule, "b"],
    ])
    expect(result).toMatchObject({ allowed: true, remaining: 1 })
  })
})

describe("getClientIp", () => {
  it("prefers the first x-forwarded-for hop", () => {
    expect(
      getClientIp(
        new Headers({
          "x-forwarded-for": " 1.2.3.4 , 10.0.0.1",
          "x-real-ip": "5.6.7.8",
        })
      )
    ).toBe("1.2.3.4")
  })

  it("falls back to x-real-ip, then unknown", () => {
    expect(getClientIp(new Headers({ "x-real-ip": "5.6.7.8" }))).toBe("5.6.7.8")
    expect(getClientIp(new Headers())).toBe("unknown")
  })
})

describe("normalizeEmailKey", () => {
  it("trims and lowercases", () => {
    expect(normalizeEmailKey("  A@B.Com ")).toBe("a@b.com")
  })
})

describe("rateLimitResponse", () => {
  it("is a 429 with a JSON error and Retry-After", async () => {
    const res = rateLimitResponse(
      {
        allowed: false,
        limit: 3,
        remaining: 0,
        resetAt: NOW,
        retryAfterSeconds: 42,
      },
      "Slow down"
    )
    expect(res.status).toBe(429)
    expect(res.headers.get("Retry-After")).toBe("42")
    expect(await res.json()).toEqual({ error: "Slow down" })
  })
})
