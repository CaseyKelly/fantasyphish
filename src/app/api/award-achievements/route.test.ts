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
vi.mock("@/lib/streaks", () => ({ getStreaksForAllUsers: vi.fn() }))

import { prisma } from "@/lib/prisma"
import * as Sentry from "@sentry/nextjs"
import { resetSentryMock, type SentryMock } from "@/test-utils/sentry-mock"
import { shouldRunCronJobs } from "@/lib/cron-helpers"
import { getStreaksForAllUsers } from "@/lib/streaks"
import { resetPrismaMock, type PrismaMock } from "@/test-utils/prisma-mock"
import { makeRequest } from "@/test-utils/request"
import { GET, POST } from "./route"

const db = prisma as unknown as PrismaMock
const sentry = Sentry as unknown as SentryMock
const cronMock = vi.mocked(shouldRunCronJobs)
const streaksMock = vi.mocked(getStreaksForAllUsers)

const authed = () =>
  makeRequest("/api/award-achievements", {
    method: "POST",
    headers: { authorization: "Bearer secret" },
  })

function pick(userId: string, username: string, song = "Tweezer") {
  return {
    submission: {
      user: { id: userId, username },
      show: { showDate: new Date("2025-07-04T00:00:00Z"), venue: "MSG" },
    },
    song: { name: song },
  }
}

const uniqueViolation = () =>
  Object.assign(new Error("Unique constraint failed"), { code: "P2002" })

beforeEach(() => {
  resetPrismaMock(db)
  resetSentryMock(sentry)
  cronMock.mockReset()
  cronMock.mockResolvedValue({ shouldRun: true })
  streaksMock.mockReset()
  streaksMock.mockResolvedValue(new Map())
  db.achievement.upsert.mockImplementation(
    async (args: { create: { name: string; slug: string } }) => ({
      id: args.create.slug,
      name: args.create.name,
    })
  )
  db.user.findMany.mockResolvedValue([])
  db.pick.findMany.mockResolvedValue([])
  vi.stubEnv("CRON_SECRET", "secret")
  vi.stubEnv("VERCEL_ENV", "production")
  vi.spyOn(console, "log").mockImplementation(() => {})
  vi.spyOn(console, "error").mockImplementation(() => {})
})

afterEach(() => {
  vi.unstubAllEnvs()
  vi.restoreAllMocks()
})

describe("/api/award-achievements auth", () => {
  it("fails closed when CRON_SECRET is unset", async () => {
    vi.stubEnv("CRON_SECRET", "")
    const res = await POST(authed())
    expect(res.status).toBe(500)
    expect(db.$disconnect).not.toHaveBeenCalled()
  })

  it("rejects a wrong or missing bearer token, even from Vercel-Cron", async () => {
    const res = await GET(
      makeRequest("/x", { headers: { "user-agent": "Vercel-Cron" } })
    )
    expect(res.status).toBe(401)
  })
})

describe("/api/award-achievements", () => {
  it("runs the tour-independent awards and skips the rest when no tour is active", async () => {
    cronMock.mockResolvedValue({ shouldRun: false, reason: "No active tours" })
    db.user.findMany
      .mockResolvedValueOnce([{ id: "u1" }, { id: "u2" }]) // notifications
      .mockResolvedValueOnce([]) // poll voters
    db.userAchievement.createMany.mockResolvedValueOnce({ count: 1 })

    const json = await (await POST(authed())).json()

    expect(json.tourAchievementsSkipped).toBe(true)
    expect(json.results[0]).toMatchObject({ awarded: 1, skipped: 1, total: 2 })
    expect(json.results[1]).toMatchObject({ awarded: 0, skipped: 0 })
    // Four streak milestones, none earned
    expect(json.results).toHaveLength(6)
    expect(db.pick.findMany).not.toHaveBeenCalled()
  })

  it("awards streak milestones by best streak", async () => {
    cronMock.mockResolvedValue({ shouldRun: false })
    streaksMock.mockResolvedValue(
      new Map([
        ["u1", { current: 0, best: 12 }],
        ["u2", { current: 5, best: 5 }],
        ["u3", { current: 1, best: 1 }],
      ])
    )
    db.userAchievement.createMany.mockImplementation(
      async (args: { data: unknown[] }) => ({ count: args.data.length })
    )

    const json = await (await POST(authed())).json()
    const streaks = json.results.slice(2)
    expect(streaks.map((r: { awarded: number }) => r.awarded)).toEqual([
      2, 1, 0, 0,
    ])
  })

  it("awards opener, closer, and jackpot from correct picks, skipping duplicates", async () => {
    db.pick.findMany
      // Openers: u1 twice (deduped), u2 already has it
      .mockResolvedValueOnce([
        pick("u1", "alice"),
        pick("u1", "alice"),
        pick("u2", "bob"),
      ])
      // Encores: none
      .mockResolvedValueOnce([])
      // Harpua: u1 awarded, u3 hits an unexpected error
      .mockResolvedValueOnce([
        pick("u1", "alice", "Harpua"),
        pick("u3", "carol", "Harpua"),
      ])
    db.userAchievement.create
      .mockResolvedValueOnce({})
      .mockRejectedValueOnce(uniqueViolation())
      .mockResolvedValueOnce({})
      .mockRejectedValueOnce(new Error("weird"))

    const json = await (await GET(authed())).json()
    const [opener, closer, jackpot] = json.results.slice(-3)

    expect(json.success).toBe(true)
    expect(opener).toMatchObject({
      achievement: "Perfect Opener",
      awarded: 1,
      skipped: 1,
      total: 2,
    })
    expect(closer).toMatchObject({ awarded: 0, skipped: 0 })
    expect(jackpot).toMatchObject({ awarded: 1, skipped: 0, total: 1 })
    expect(db.userAchievement.create.mock.calls[0][0].data.metadata).toEqual({
      firstCorrectShow: "2025-07-04T00:00:00.000Z",
      venue: "MSG",
      songName: "Tweezer",
    })
  })

  it("counts duplicate jackpots as skipped and logs unexpected opener errors", async () => {
    db.pick.findMany
      .mockResolvedValueOnce([pick("u1", "alice")])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([pick("u2", "bob", "Harpua")])
    db.userAchievement.create
      .mockRejectedValueOnce(new Error("weird"))
      .mockRejectedValueOnce(uniqueViolation())

    const json = await (await POST(authed())).json()
    const [opener, , jackpot] = json.results.slice(-3)
    expect(opener).toMatchObject({ awarded: 0, skipped: 0 })
    expect(jackpot).toMatchObject({ awarded: 0, skipped: 1 })
  })

  it("returns 500 with details when something throws", async () => {
    db.achievement.upsert.mockRejectedValueOnce(new Error("db down"))
    const res = await POST(authed())
    expect(res.status).toBe(500)
    expect((await res.json()).details).toBe("db down")
  })

  it("stringifies non-Error failures", async () => {
    cronMock.mockRejectedValue("weird")
    expect((await (await POST(authed())).json()).details).toBe("weird")
  })
})

describe("/api/award-achievements cron monitor", () => {
  it("does not check in for an unauthorized request", async () => {
    await POST(makeRequest("/x", { headers: { authorization: "Bearer nope" } }))
    expect(sentry.withMonitor).not.toHaveBeenCalled()
    expect(sentry.checkIns).toEqual([])
  })

  it("checks in ok when there is nothing to do", async () => {
    cronMock.mockResolvedValue({ shouldRun: false, reason: "No active tours" })
    expect((await GET(authed())).status).toBe(200)
    expect(sentry.checkIns).toEqual([
      { slug: "fantasyphish-award-achievements", status: "ok" },
    ])
  })

  it("marks the check-in failed when the job returns a 500", async () => {
    db.achievement.upsert.mockRejectedValueOnce(new Error("db down"))
    expect((await POST(authed())).status).toBe(500)
    expect(sentry.checkIns).toEqual([
      { slug: "fantasyphish-award-achievements", status: "error" },
    ])
  })
})
