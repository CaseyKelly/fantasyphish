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

function show(overrides: Record<string, unknown> = {}) {
  return {
    showid: 1,
    showdate: "2025-07-04",
    venue: "MSG",
    city: "New York",
    state: "NY",
    country: "USA",
    tour_name: "Summer Tour",
    tourid: 10,
    artistid: 1,
    artist_name: "Phish",
    ...overrides,
  }
}

function respondWith(byYear: Record<string, unknown[]>) {
  fetchMock.mockImplementation(async (url: string) => {
    const year = /showyear\/(\d+)/.exec(url)?.[1] ?? ""
    return {
      ok: true,
      json: async () => ({
        error: false,
        error_message: "",
        data: byYear[year] ?? [],
      }),
    }
  })
}

const req = (
  headers: Record<string, string> = { authorization: "Bearer secret" }
) => makeRequest("/api/sync-tours", { method: "POST", headers })

beforeEach(() => {
  resetPrismaMock(db)
  resetSentryMock(sentry)
  cronMock.mockReset()
  cronMock.mockResolvedValue({ shouldRun: true })
  fetchMock.mockReset()
  vi.stubGlobal("fetch", fetchMock)
  vi.stubEnv("CRON_SECRET", "secret")
  vi.stubEnv("PHISHNET_API_KEY", "key")
  vi.useFakeTimers({ toFake: ["Date"] })
  vi.setSystemTime(new Date("2025-06-01T12:00:00Z"))
  db.tour.findMany.mockResolvedValue([])
  db.show.findMany.mockResolvedValue([])
  db.show.aggregate.mockResolvedValue({
    _min: { showDate: null },
    _max: { showDate: null },
  })
  vi.spyOn(console, "log").mockImplementation(() => {})
  vi.spyOn(console, "error").mockImplementation(() => {})
})

afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllGlobals()
  vi.unstubAllEnvs()
  vi.restoreAllMocks()
})

describe("/api/sync-tours auth and gating", () => {
  it("rejects a bad secret", async () => {
    expect((await POST(req({ authorization: "Bearer nope" }))).status).toBe(401)
  })

  it("skips when no tours are active", async () => {
    cronMock.mockResolvedValue({ shouldRun: false, reason: "No active tours" })
    const json = await (await GET(req())).json()
    expect(json).toEqual({ skipped: true, reason: "No active tours" })
  })
})

describe("/api/sync-tours", () => {
  it("creates new tours and shows for this year and next, ignoring other artists", async () => {
    respondWith({
      "2025": [
        show(),
        show({
          showid: 2,
          showdate: "2025-07-05",
          state: "CO",
          venue: "Dicks",
        }),
        show({ showid: 3, artistid: 2 }),
      ],
      "2026": [],
    })

    const json = await (await POST(req())).json()

    expect(fetchMock.mock.calls.map((c) => c[0])).toEqual([
      "https://api.phish.net/v5/shows/showyear/2025.json?apikey=key",
      "https://api.phish.net/v5/shows/showyear/2026.json?apikey=key",
    ])
    expect(json).toMatchObject({
      success: true,
      totalTours: 1,
      totalShows: 2,
      totalToursCreated: 1,
      totalShowsCreated: 2,
    })
    expect(db.tour.create.mock.calls[0][0].data).toMatchObject({
      id: "phishnet-10",
      name: "Summer Tour",
    })
    const created = db.show.create.mock.calls.map(
      (c) => (c[0] as { data: { timezone: string; lockTime: Date } }).data
    )
    expect(created[0].timezone).toBe("America/New_York")
    expect(created[0].lockTime.toISOString()).toBe("2025-07-04T23:00:00.000Z")
    expect(created[1].timezone).toBe("America/Denver")
    // Brand-new tour dates already match the fetched shows
    expect(db.tour.update).not.toHaveBeenCalled()
  })

  it("skips completed shows, custom-tour shows, and unchanged shows; updates changed ones", async () => {
    const d = (s: string) => new Date(`${s}T00:00:00Z`)
    respondWith({
      "2025": [
        show({ showdate: "2025-07-01" }),
        show({ showdate: "2025-07-02" }),
        show({ showdate: "2025-07-03" }),
        show({ showdate: "2025-07-04", venue: "New Venue" }),
        show({ showdate: "2025-07-05" }),
      ],
    })
    db.tour.findMany.mockResolvedValue([
      {
        id: "phishnet-10",
        name: "Old Name",
        startDate: d("2025-07-01"),
        endDate: d("2025-07-05"),
      },
    ])
    const base = {
      venue: "MSG",
      city: "New York",
      state: "NY",
      country: "USA",
      tourId: "phishnet-10",
      timezone: "America/New_York",
      lockTimeOverride: null,
      isComplete: false,
    }
    db.show.findMany.mockResolvedValue([
      { ...base, showDate: d("2025-07-01"), isComplete: true },
      { ...base, showDate: d("2025-07-02"), tourId: "custom-run" },
      {
        ...base,
        showDate: d("2025-07-03"),
        lockTime: new Date("2025-07-03T23:00:00Z"),
      },
      {
        ...base,
        showDate: d("2025-07-04"),
        lockTime: new Date("2025-07-04T23:00:00Z"),
      },
      {
        ...base,
        showDate: d("2025-07-05"),
        lockTime: new Date("2025-07-05T23:00:00Z"),
        lockTimeOverride: new Date("2025-07-05T20:00:00Z"),
      },
    ])
    db.show.aggregate.mockResolvedValue({
      _min: { showDate: d("2025-07-01") },
      _max: { showDate: d("2025-07-05") },
    })

    const json = await (await POST(req())).json()
    const year = json.years[0]

    expect(year).toMatchObject({
      showsSkippedComplete: 1,
      showsSkipped: 2, // custom tour + unchanged
      showsUpdated: 2, // venue change + override drift
      toursUpdated: 1, // renamed
    })
    const updates = db.show.update.mock.calls.map(
      (c) => (c[0] as { data: { venue: string; lockTime: Date } }).data
    )
    expect(updates[0].venue).toBe("New Venue")
    // The override wins over the computed lock time
    expect(updates[1].lockTime.toISOString()).toBe("2025-07-05T20:00:00.000Z")
    expect(db.tour.update.mock.calls[0][0].data.name).toBe("Summer Tour")
  })

  it("widens tour dates from shows already in the DB (e.g. NYE runs)", async () => {
    const d = (s: string) => new Date(`${s}T00:00:00Z`)
    respondWith({ "2025": [show({ showdate: "2025-12-30" })] })
    db.tour.findMany.mockResolvedValue([
      {
        id: "phishnet-10",
        name: "Summer Tour",
        startDate: d("2025-12-30"),
        endDate: d("2025-12-30"),
      },
    ])
    db.show.aggregate.mockResolvedValue({
      _min: { showDate: d("2025-12-30") },
      _max: { showDate: d("2026-01-01") },
    })

    const json = await (await POST(req())).json()

    expect(json.years[0].toursUpdated).toBe(1)
    expect(db.tour.update.mock.calls[0][0].data.endDate).toEqual(
      d("2026-01-01")
    )
  })

  it("leaves an unchanged existing tour alone", async () => {
    const d = (s: string) => new Date(`${s}T00:00:00Z`)
    respondWith({ "2025": [show()] })
    db.tour.findMany.mockResolvedValue([
      {
        id: "phishnet-10",
        name: "Summer Tour",
        startDate: d("2025-07-04"),
        endDate: d("2025-07-04"),
      },
    ])
    const json = await (await POST(req())).json()
    expect(json.years[0].toursUpdated).toBe(0)
    expect(db.tour.update).not.toHaveBeenCalled()
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
          status: 503,
          statusText: "Down",
        }),
      "API error: 503 Down",
    ],
    [
      "API error body",
      () =>
        fetchMock.mockResolvedValue({
          ok: true,
          json: async () => ({ error: true, error_message: "bad key" }),
        }),
      "API error: bad key",
    ],
  ])("returns 500 on %s", async (_label, setup, message) => {
    setup()
    const res = await POST(req())
    expect(res.status).toBe(500)
    expect((await res.json()).error).toBe(message)
  })

  it("handles a null data payload and non-Error throws", async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({ error: false, data: null }),
    })
    expect((await (await POST(req())).json()).totalShows).toBe(0)

    cronMock.mockRejectedValue("weird")
    expect((await (await POST(req())).json()).error).toBe("Unknown error")
  })
})

describe("/api/sync-tours cron monitor", () => {
  it("does not check in for an unauthorized request", async () => {
    await POST(req({ authorization: "Bearer nope" }))
    expect(sentry.withMonitor).not.toHaveBeenCalled()
    expect(sentry.checkIns).toEqual([])
  })

  it("checks in ok when there is nothing to do", async () => {
    cronMock.mockResolvedValue({ shouldRun: false, reason: "No active tours" })
    expect((await GET(req())).status).toBe(200)
    expect(sentry.checkIns).toEqual([
      { slug: "fantasyphish-sync-tours", status: "ok" },
    ])
  })

  it("marks the check-in failed when the job returns a 500", async () => {
    cronMock.mockRejectedValue(new Error("boom"))
    expect((await POST(req())).status).toBe(500)
    expect(sentry.checkIns).toEqual([
      { slug: "fantasyphish-sync-tours", status: "error" },
    ])
  })
})
