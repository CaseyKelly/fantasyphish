import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"

vi.mock("@/lib/prisma", async () => {
  const { createPrismaMock } = await import("@/test-utils/prisma-mock")
  return { prisma: createPrismaMock() }
})
vi.mock("next-auth/react", () => ({ signIn: vi.fn() }))

import { signIn } from "next-auth/react"
import { prisma } from "@/lib/prisma"
import { resetPrismaMock, type PrismaMock } from "@/test-utils/prisma-mock"
import { shouldRunCronJobs } from "./cron-helpers"
import { isProduction, isAdminFeaturesEnabled } from "./env"
import { signInWithRetry } from "./auth-client"
import { cn } from "./cn"

const db = prisma as unknown as PrismaMock

beforeEach(() => {
  resetPrismaMock(db)
})

afterEach(() => {
  vi.unstubAllEnvs()
})

describe("shouldRunCronJobs", () => {
  it("skips when there are no active tours", async () => {
    db.tour.count.mockResolvedValue(0)
    expect(await shouldRunCronJobs()).toEqual({
      shouldRun: false,
      reason: "No active tours",
    })
    expect(db.tour.count).toHaveBeenCalledWith({ where: { status: "ACTIVE" } })
  })

  it("runs when at least one tour is active", async () => {
    db.tour.count.mockResolvedValue(2)
    expect(await shouldRunCronJobs()).toEqual({ shouldRun: true })
  })
})

describe("isProduction", () => {
  it("is true only for the Vercel production environment", () => {
    vi.stubEnv("VERCEL_ENV", "production")
    expect(isProduction()).toBe(true)
  })

  it("treats a local production build as dev", () => {
    vi.stubEnv("VERCEL_ENV", "")
    vi.stubEnv("NODE_ENV", "production")
    expect(isProduction()).toBe(false)
  })

  it("is false for preview deployments", () => {
    vi.stubEnv("VERCEL_ENV", "preview")
    expect(isProduction()).toBe(false)
  })

  it("always enables admin features", () => {
    expect(isAdminFeaturesEnabled()).toBe(true)
  })
})

describe("signInWithRetry", () => {
  const signInMock = vi.mocked(signIn)

  beforeEach(() => {
    signInMock.mockReset()
  })

  it("returns the first result when it succeeds", async () => {
    signInMock.mockResolvedValueOnce({ ok: true, error: undefined } as never)
    expect(await signInWithRetry("a@b.com", "pw")).toEqual({
      ok: true,
      error: undefined,
    })
    expect(signInMock).toHaveBeenCalledTimes(1)
    expect(signInMock).toHaveBeenCalledWith("credentials", {
      email: "a@b.com",
      password: "pw",
      redirect: false,
    })
  })

  it("retries once after a returned error", async () => {
    signInMock
      .mockResolvedValueOnce({ error: "CredentialsSignin" } as never)
      .mockResolvedValueOnce({ ok: true } as never)
    expect(await signInWithRetry("a@b.com", "pw")).toEqual({ ok: true })
    expect(signInMock).toHaveBeenCalledTimes(2)
  })

  it("does not retry a rate-limited sign-in", async () => {
    signInMock.mockResolvedValueOnce({
      error: "CredentialsSignin",
      code: "rate_limited",
    } as never)
    expect(await signInWithRetry("a@b.com", "pw")).toMatchObject({
      code: "rate_limited",
    })
    expect(signInMock).toHaveBeenCalledTimes(1)
  })

  it("retries once after a thrown error", async () => {
    signInMock
      .mockRejectedValueOnce(new Error("csrf"))
      .mockResolvedValueOnce({ ok: true } as never)
    expect(await signInWithRetry("a@b.com", "pw")).toEqual({ ok: true })
  })
})

describe("cn", () => {
  it("drops falsy values and lets later Tailwind classes win", () => {
    expect(cn("px-4 py-3", false, null, undefined, "p-0")).toBe("p-0")
    expect(cn("a", "b")).toBe("a b")
  })
})
