import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"

vi.mock("@/lib/prisma", async () => {
  const { createPrismaMock } = await import("@/test-utils/prisma-mock")
  return { prisma: createPrismaMock() }
})
vi.mock("@/lib/cron-helpers", () => ({ shouldRunCronJobs: vi.fn() }))
vi.mock("@sentry/nextjs", async () => {
  const { createSentryMock } = await import("@/test-utils/sentry-mock")
  return createSentryMock()
})

import { prisma } from "@/lib/prisma"
import * as Sentry from "@sentry/nextjs"
import { resetSentryMock, type SentryMock } from "@/test-utils/sentry-mock"
import { shouldRunCronJobs } from "@/lib/cron-helpers"
import { resetPrismaMock, type PrismaMock } from "@/test-utils/prisma-mock"
import { makeRequest } from "@/test-utils/request"
import { GET, POST } from "./route"

const db = prisma as unknown as PrismaMock
const sentry = Sentry as unknown as SentryMock
const cronMock = vi.mocked(shouldRunCronJobs)
const fetchMock = vi.fn()

const req = (auth = "Bearer secret") =>
  makeRequest("/api/sync-song-stats", {
    method: "POST",
    headers: { authorization: auth },
  })

function songs(data: unknown) {
  fetchMock.mockResolvedValue({
    ok: true,
    json: async () => ({ error: false, error_message: "", data }),
  })
}

beforeEach(() => {
  resetPrismaMock(db)
  resetSentryMock(sentry)
  cronMock.mockReset()
  cronMock.mockResolvedValue({ shouldRun: true })
  fetchMock.mockReset()
  vi.stubGlobal("fetch", fetchMock)
  vi.stubEnv("CRON_SECRET", "secret")
  vi.stubEnv("PHISHNET_API_KEY", "key")
  vi.spyOn(console, "log").mockImplementation(() => {})
  vi.spyOn(console, "warn").mockImplementation(() => {})
  vi.spyOn(console, "error").mockImplementation(() => {})
})

afterEach(() => {
  vi.unstubAllGlobals()
  vi.unstubAllEnvs()
  vi.restoreAllMocks()
})

describe("/api/sync-song-stats", () => {
  it("fails closed without CRON_SECRET and rejects bad tokens", async () => {
    vi.stubEnv("CRON_SECRET", "")
    expect((await POST(req())).status).toBe(500)
    vi.stubEnv("CRON_SECRET", "secret")
    expect((await POST(req("Bearer nope"))).status).toBe(401)
  })

  it("skips when no tours are active", async () => {
    cronMock.mockResolvedValue({ shouldRun: false, reason: "No active tours" })
    expect(await (await GET(req())).json()).toEqual({
      skipped: true,
      reason: "No active tours",
    })
  })

  it("upserts stats and parses last_played as a UTC date", async () => {
    songs([
      {
        song: "Tweezer",
        slug: "tweezer",
        artist: "",
        last_played: "2025-07-04",
        times_played: 400,
        gap: 2,
      },
      {
        song: "Fee",
        slug: "fee",
        artist: "Phish",
        last_played: "",
        times_played: 0,
        gap: 50,
      },
      {
        song: "Odd",
        slug: "odd",
        artist: "Phish",
        last_played: "July 4",
        times_played: 1,
        gap: 1,
      },
    ])
    db.song.upsert.mockResolvedValue({})

    const json = await (await POST(req())).json()

    expect(json).toMatchObject({
      success: true,
      updated: 3,
      errors: 0,
      total: 3,
    })
    const first = db.song.upsert.mock.calls[0][0]
    expect(first.create).toMatchObject({ artist: "Phish", timesPlayed: 400 })
    expect(first.update.lastPlayed.toISOString()).toBe(
      "2025-07-04T00:00:00.000Z"
    )
    expect(db.song.upsert.mock.calls[1][0].update.lastPlayed).toBeNull()
    expect(db.song.upsert.mock.calls[2][0].update.lastPlayed).toBeNull()
    expect(console.warn).toHaveBeenCalledTimes(1)
  })

  it("counts per-song failures without aborting the sync", async () => {
    songs(
      Array.from({ length: 7 }, (_, i) => ({
        song: `S${i}`,
        slug: `s${i}`,
        artist: "Phish",
        last_played: "",
        times_played: undefined,
        gap: 0,
      }))
    )
    db.song.upsert
      .mockRejectedValueOnce("not an Error")
      .mockRejectedValue(new Error("constraint"))

    const json = await (await POST(req())).json()
    expect(json).toMatchObject({ updated: 0, errors: 7 })
    // Only the first 5 errors are logged
    expect(console.error).toHaveBeenCalledTimes(5)
  })

  it.each([
    [
      "missing API key",
      () => vi.stubEnv("PHISHNET_API_KEY", ""),
      "PHISHNET_API_KEY is not set",
    ],
    [
      "HTTP error",
      () =>
        fetchMock.mockResolvedValue({
          ok: false,
          status: 500,
          statusText: "Err",
        }),
      "API error: 500 Err",
    ],
    [
      "API error body",
      () =>
        fetchMock.mockResolvedValue({
          ok: true,
          json: async () => ({ error: true, error_message: "bad" }),
        }),
      "API error: bad",
    ],
  ])("returns 500 on %s", async (_label, setup, message) => {
    setup()
    const res = await POST(req())
    expect(res.status).toBe(500)
    expect((await res.json()).error).toBe(message)
  })

  it("handles null data and non-Error throws", async () => {
    songs(null)
    expect((await (await POST(req())).json()).total).toBe(0)
    cronMock.mockRejectedValue("weird")
    expect((await (await POST(req())).json()).error).toBe("Unknown error")
  })
})

describe("/api/sync-song-stats cron monitor", () => {
  it("does not check in for an unauthorized request", async () => {
    await POST(req("Bearer nope"))
    expect(sentry.withMonitor).not.toHaveBeenCalled()
    expect(sentry.checkIns).toEqual([])
  })

  it("checks in ok when there is nothing to do", async () => {
    cronMock.mockResolvedValue({ shouldRun: false, reason: "No active tours" })
    expect((await GET(req())).status).toBe(200)
    expect(sentry.checkIns).toEqual([
      { slug: "fantasyphish-sync-song-stats", status: "ok" },
    ])
  })

  it("marks the check-in failed when the job returns a 500", async () => {
    cronMock.mockRejectedValue(new Error("boom"))
    expect((await POST(req())).status).toBe(500)
    expect(sentry.checkIns).toEqual([
      { slug: "fantasyphish-sync-song-stats", status: "error" },
    ])
  })
})
