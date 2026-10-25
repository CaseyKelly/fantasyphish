import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"

vi.mock("@/lib/prisma", async () => {
  const { createPrismaMock } = await import("@/test-utils/prisma-mock")
  return { prisma: createPrismaMock() }
})
vi.mock("@/lib/phishnet", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/phishnet")>()),
  getSetlist: vi.fn(),
}))
vi.mock("@/lib/cron-helpers", () => ({ shouldRunCronJobs: vi.fn() }))
vi.mock("@sentry/nextjs", async () => {
  const { createSentryMock } = await import("@/test-utils/sentry-mock")
  return createSentryMock()
})
vi.mock("@/lib/show-scoring", () => ({ scoreShow: vi.fn() }))

import { prisma } from "@/lib/prisma"
import * as Sentry from "@sentry/nextjs"
import { resetSentryMock, type SentryMock } from "@/test-utils/sentry-mock"
import { getSetlist } from "@/lib/phishnet"
import { shouldRunCronJobs } from "@/lib/cron-helpers"
import { scoreShow } from "@/lib/show-scoring"
import { resetPrismaMock, type PrismaMock } from "@/test-utils/prisma-mock"
import { makeRequest } from "@/test-utils/request"
import { GET, POST } from "./route"

const db = prisma as unknown as PrismaMock
const sentry = Sentry as unknown as SentryMock
const cronMock = vi.mocked(shouldRunCronJobs)
const setlistMock = vi.mocked(getSetlist)
const scoreMock = vi.mocked(scoreShow)

function req(headers: Record<string, string> = {}) {
  return makeRequest("/api/score", { method: "POST", headers })
}

const show = {
  id: "show-1",
  showDate: new Date("2025-07-04T00:00:00Z"),
  venue: "MSG",
  city: "New York",
  submissions: [],
}

const setlist = {
  songs: [
    { song: "Tweezer", set: "1", position: 1 },
    { song: "Harpua", set: "e", position: 1 },
  ],
}

beforeEach(() => {
  resetPrismaMock(db)
  resetSentryMock(sentry)
  cronMock.mockReset()
  cronMock.mockResolvedValue({ shouldRun: true })
  setlistMock.mockReset()
  scoreMock.mockReset()
  vi.stubEnv("CRON_SECRET", "secret")
  vi.spyOn(console, "log").mockImplementation(() => {})
  vi.spyOn(console, "error").mockImplementation(() => {})
})

afterEach(() => {
  vi.unstubAllEnvs()
  vi.restoreAllMocks()
})

describe("/api/score", () => {
  it("rejects requests without the cron secret", async () => {
    const res = await POST(req())
    expect(res.status).toBe(401)
    expect(db.$disconnect).not.toHaveBeenCalled()
  })

  it("allows a matching bearer token but not a spoofed Vercel-Cron user agent", async () => {
    db.show.findMany.mockResolvedValue([])
    expect((await POST(req({ "user-agent": "Vercel-Cron" }))).status).toBe(401)
    expect((await POST(req({ authorization: "Bearer secret" }))).status).toBe(
      200
    )
  })

  it("rejects every request when CRON_SECRET is unset", async () => {
    vi.stubEnv("CRON_SECRET", "")
    expect((await POST(req())).status).toBe(500)
    expect((await POST(req({ authorization: "Bearer " }))).status).toBe(500)
  })

  it("skips when no tours are active", async () => {
    cronMock.mockResolvedValue({ shouldRun: false, reason: "No active tours" })
    const json = await (
      await GET(req({ authorization: "Bearer secret" }))
    ).json()
    expect(json).toEqual({ skipped: true, reason: "No active tours" })
  })

  it("skips gracefully when the database is unreachable", async () => {
    cronMock.mockRejectedValue(new Error("Can't reach database server"))
    const res = await POST(req({ authorization: "Bearer secret" }))
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({
      skipped: true,
      reason: "database_unavailable",
    })
  })

  it("500s on other errors from the active-tour check", async () => {
    cronMock.mockRejectedValue("weird")
    const res = await POST(req({ authorization: "Bearer secret" }))
    expect(res.status).toBe(500)
    expect((await res.json()).details).toBe("weird")
  })

  it("scores each locked show and reports shows with no setlist yet", async () => {
    db.show.findMany.mockResolvedValue([
      show,
      { ...show, id: "show-2", showDate: new Date("2025-07-05T00:00:00Z") },
    ])
    setlistMock
      .mockResolvedValueOnce(setlist as never)
      .mockResolvedValueOnce(null)
    scoreMock.mockResolvedValue({
      status: "completed",
      songCount: 2,
      submissionsProcessed: 0,
      submissionsUpdated: 0,
      setlist: {} as never,
    })

    const json = await (
      await POST(req({ authorization: "Bearer secret" }))
    ).json()

    expect(json.success).toBe(true)
    expect(json.showsProcessed).toBe(2)
    expect(json.results[0]).toMatchObject({
      showId: "show-1",
      showDate: "2025-07-04",
      status: "completed",
    })
    expect(json.results[1]).toMatchObject({
      showId: "show-2",
      status: "no_setlist",
    })
    expect(setlistMock).toHaveBeenCalledWith("2025-07-04", { noCache: true })
  })

  it("logs N/A for setlists without an opener or encore", async () => {
    db.show.findMany.mockResolvedValue([show])
    setlistMock.mockResolvedValue({ songs: [] } as never)
    scoreMock.mockResolvedValue({ status: "in_progress" } as never)
    await POST(req({ authorization: "Bearer secret" }))
    expect(console.log).toHaveBeenCalledWith(
      expect.stringContaining("Opener: N/A")
    )
  })

  it("returns 500 when scoring throws", async () => {
    db.show.findMany.mockRejectedValue(new Error("query failed"))
    const res = await POST(req({ authorization: "Bearer secret" }))
    expect(res.status).toBe(500)
    expect((await res.json()).details).toBe("query failed")
  })
})

describe("/api/score cron monitor", () => {
  it("does not check in for an unauthorized request", async () => {
    await POST(req())
    expect(sentry.withMonitor).not.toHaveBeenCalled()
    expect(sentry.checkIns).toEqual([])
  })

  it("checks in ok when there is nothing to do", async () => {
    cronMock.mockResolvedValue({ shouldRun: false, reason: "No active tours" })
    expect((await GET(req({ authorization: "Bearer secret" }))).status).toBe(
      200
    )
    expect(sentry.checkIns).toEqual([
      { slug: "fantasyphish-score", status: "ok" },
    ])
  })

  it("marks the check-in failed when the job returns a 500", async () => {
    cronMock.mockRejectedValue(new Error("boom"))
    expect((await POST(req({ authorization: "Bearer secret" }))).status).toBe(
      500
    )
    expect(sentry.checkIns).toEqual([
      { slug: "fantasyphish-score", status: "error" },
    ])
  })
})
