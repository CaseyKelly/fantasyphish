import { describe, it, expect, vi, beforeEach } from "vitest"

// Small admin endpoints share the same auth gate and mocks, so they're
// tested together here rather than one file per route.
vi.mock("@/lib/prisma", async () => {
  const { createPrismaMock } = await import("@/test-utils/prisma-mock")
  return { prisma: createPrismaMock() }
})
vi.mock("@/lib/auth", () => ({ auth: vi.fn() }))
vi.mock("@/lib/env", () => ({ isAdminFeaturesEnabled: vi.fn(() => true) }))
vi.mock("@/lib/phishnet", () => ({
  getSetlist: vi.fn(),
  hasShowStarted: vi.fn(),
}))
vi.mock("@/lib/show-scoring", () => ({
  scoreShow: vi.fn(),
  showWithSubmissionsInclude: {},
}))
vi.mock("@/lib/push", () => ({ sendPushNotification: vi.fn() }))
vi.mock("@/lib/reminders", () => ({ sendPickReminders: vi.fn() }))

import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { isAdminFeaturesEnabled } from "@/lib/env"
import { getSetlist, hasShowStarted } from "@/lib/phishnet"
import { scoreShow } from "@/lib/show-scoring"
import { sendPushNotification } from "@/lib/push"
import { sendPickReminders } from "@/lib/reminders"
import { resetPrismaMock, type PrismaMock } from "@/test-utils/prisma-mock"
import { makeRequest, routeParams, sessionFor } from "@/test-utils/request"
import { POST as completeShow } from "./complete-show/route"
import { GET as debugEnv } from "./debug-env/route"
import { DELETE as deleteSubmission } from "./delete-submission/[id]/route"
import { POST as impersonate } from "./impersonate/route"
import { POST as markOldShowsComplete } from "./mark-old-shows-complete/route"
import { POST as resetShow } from "./reset-show/route"
import { POST as setLockOverride } from "./set-show-lock-override/route"
import { POST as setSetCount } from "./set-show-set-count/route"
import { POST as stopImpersonate } from "./stop-impersonate/route"
import { POST as testPush } from "./test-push/route"
import { POST as testReminders } from "./test-reminders/route"
import { GET as listUsers } from "./users/route"

const db = prisma as unknown as PrismaMock
const authMock = vi.mocked(auth)
const adminEnabled = vi.mocked(isAdminFeaturesEnabled)

const admin = () =>
  sessionFor({ id: "admin-1", username: "root", isAdmin: true })
const user = () => sessionFor({ id: "user-1", isAdmin: false })

function post(path: string, body?: unknown) {
  return makeRequest(path, { method: "POST", body })
}

beforeEach(() => {
  resetPrismaMock(db)
  vi.clearAllMocks()
  adminEnabled.mockReturnValue(true)
  authMock.mockResolvedValue(admin())
  vi.spyOn(console, "log").mockImplementation(() => {})
  vi.spyOn(console, "error").mockImplementation(() => {})
})

describe("admin auth gate", () => {
  const gated: [string, () => Promise<Response>][] = [
    ["complete-show", () => completeShow(post("/x", { showId: "s" }))],
    ["debug-env", () => debugEnv()],
    [
      "delete-submission",
      () => deleteSubmission(makeRequest("/x"), routeParams({ id: "sub" })),
    ],
    ["mark-old-shows-complete", () => markOldShowsComplete(post("/x", {}))],
    ["reset-show", () => resetShow(post("/x", { showId: "s" }))],
    [
      "set-show-lock-override",
      () => setLockOverride(post("/x", { showId: "s", lockTime: null })),
    ],
    [
      "set-show-set-count",
      () => setSetCount(post("/x", { showId: "s", setCount: 2 })),
    ],
    ["test-push", () => testPush()],
    ["test-reminders", () => testReminders(post("/x", {}))],
  ]

  it.each(gated)("%s rejects non-admins", async (_name, call) => {
    authMock.mockResolvedValue(user())
    expect((await call()).status).toBe(401)
  })

  it.each(gated)("%s rejects anonymous users", async (_name, call) => {
    authMock.mockResolvedValue(null as never)
    expect((await call()).status).toBe(401)
  })

  it.each(gated)(
    "%s rejects when admin features are off",
    async (_name, call) => {
      adminEnabled.mockReturnValue(false)
      expect((await call()).status).toBe(401)
    }
  )
})

describe("POST /api/admin/complete-show", () => {
  it("rejects invalid JSON and missing showId", async () => {
    expect((await completeShow(post("/x", "{bad"))).status).toBe(400)
    expect((await completeShow(post("/x", { showId: "" }))).status).toBe(400)
  })

  it("404s for unknown shows and rejects completed ones", async () => {
    db.show.findUnique.mockResolvedValueOnce(null)
    expect((await completeShow(post("/x", { showId: "s" }))).status).toBe(404)
    db.show.findUnique.mockResolvedValueOnce({ isComplete: true })
    const res = await completeShow(post("/x", { showId: "s" }))
    expect((await res.json()).error).toBe("Show is already complete")
  })

  it("requires a setlist", async () => {
    db.show.findUnique.mockResolvedValue({
      isComplete: false,
      showDate: new Date("2025-07-04T00:00:00Z"),
    })
    vi.mocked(getSetlist).mockResolvedValue(null)
    const res = await completeShow(post("/x", { showId: "s" }))
    expect((await res.json()).error).toBe("No setlist data available yet")
  })

  it("force-completes the show", async () => {
    const show = {
      isComplete: false,
      showDate: new Date("2025-07-04T00:00:00Z"),
    }
    db.show.findUnique.mockResolvedValue(show)
    vi.mocked(getSetlist).mockResolvedValue({ songs: [] } as never)
    vi.mocked(scoreShow).mockResolvedValue({
      status: "completed",
      submissionsUpdated: 2,
      submissionsProcessed: 2,
    } as never)

    const json = await (await completeShow(post("/x", { showId: "s" }))).json()

    expect(json).toMatchObject({ success: true, status: "completed" })
    expect(vi.mocked(scoreShow).mock.calls[0][2]).toMatchObject({
      forceComplete: true,
    })
    expect(getSetlist).toHaveBeenCalledWith("2025-07-04", { noCache: true })
  })

  it("returns the error message on failure", async () => {
    db.show.findUnique.mockRejectedValueOnce(new Error("db down"))
    const res = await completeShow(post("/x", { showId: "s" }))
    expect(res.status).toBe(500)
    expect((await res.json()).error).toBe("db down")
    db.show.findUnique.mockRejectedValueOnce("x")
    const res2 = await completeShow(post("/x", { showId: "s" }))
    expect((await res2.json()).error).toBe("Failed to complete show")
  })
})

describe("GET /api/admin/debug-env", () => {
  it("reports whether the phish.net key is set without leaking it", async () => {
    vi.stubEnv("PHISHNET_API_KEY", "abcdefgh")
    expect(await (await debugEnv()).json()).toEqual({
      hasApiKey: true,
      keyLength: 8,
      keyStart: "abcd",
    })
    vi.stubEnv("PHISHNET_API_KEY", "")
    expect(await (await debugEnv()).json()).toEqual({
      hasApiKey: false,
      keyLength: 0,
      keyStart: "none",
    })
    vi.unstubAllEnvs()
  })

  it("returns 500 if the check throws", async () => {
    authMock.mockRejectedValue(new Error("x"))
    expect((await debugEnv()).status).toBe(500)
  })
})

describe("DELETE /api/admin/delete-submission/[id]", () => {
  const call = (id: string) =>
    deleteSubmission(makeRequest("/x"), routeParams({ id }))

  it("requires an id", async () => {
    expect((await call("")).status).toBe(400)
  })

  it("404s for unknown submissions", async () => {
    db.submission.findUnique.mockResolvedValue(null)
    expect((await call("sub-1")).status).toBe(404)
  })

  it("deletes the submission", async () => {
    db.submission.findUnique.mockResolvedValue({
      user: { username: "alice" },
      show: { venue: "MSG", showDate: new Date("2025-07-04T00:00:00Z") },
    })
    const json = await (await call("sub-1")).json()
    expect(json).toEqual({
      success: true,
      message: "Deleted submission by alice for MSG",
    })
    expect(db.submission.delete).toHaveBeenCalledWith({
      where: { id: "sub-1" },
    })
  })

  it("returns 500 with the error message", async () => {
    db.submission.findUnique.mockRejectedValueOnce(new Error("nope"))
    expect((await (await call("sub-1")).json()).error).toBe("nope")
    db.submission.findUnique.mockRejectedValueOnce(1)
    expect((await (await call("sub-1")).json()).error).toBe(
      "Failed to delete submission"
    )
  })
})

describe("POST /api/admin/impersonate", () => {
  it("is disabled when admin features are off", async () => {
    adminEnabled.mockReturnValue(false)
    expect((await impersonate(post("/x", { userId: "u" }))).status).toBe(403)
  })

  it("requires a session and admin rights", async () => {
    authMock.mockResolvedValue(null as never)
    expect((await impersonate(post("/x", { userId: "u" }))).status).toBe(401)
    authMock.mockResolvedValue(user())
    expect((await impersonate(post("/x", { userId: "u" }))).status).toBe(403)
  })

  it("validates the target", async () => {
    expect((await impersonate(post("/x", {}))).status).toBe(400)
    const self = await impersonate(post("/x", { userId: "admin-1" }))
    expect((await self.json()).error).toBe("Cannot impersonate yourself")
    db.user.findUnique.mockResolvedValue(null)
    expect((await impersonate(post("/x", { userId: "u2" }))).status).toBe(404)
  })

  it("returns impersonation data for the client", async () => {
    db.user.findUnique.mockResolvedValue({
      id: "u2",
      username: "bob",
      email: "b@x.com",
      isAdmin: false,
    })
    const json = await (await impersonate(post("/x", { userId: "u2" }))).json()
    expect(json).toEqual({
      success: true,
      impersonation: {
        originalUserId: "admin-1",
        originalUsername: "root",
        originalIsAdmin: true,
        targetUser: {
          id: "u2",
          username: "bob",
          email: "b@x.com",
          isAdmin: false,
        },
      },
    })
  })

  it("keeps the original admin when switching while already impersonating", async () => {
    authMock.mockResolvedValue(
      sessionFor(
        { id: "u2", isAdmin: false },
        {
          impersonating: {
            originalUserId: "admin-1",
            originalUsername: "root",
            originalIsAdmin: true,
          },
        }
      )
    )
    db.user.findUnique.mockResolvedValue({
      id: "u3",
      username: "carol",
      email: "c@x.com",
      isAdmin: false,
    })
    const json = await (await impersonate(post("/x", { userId: "u3" }))).json()
    expect(json.impersonation.originalUserId).toBe("admin-1")
  })
})

describe("POST /api/admin/stop-impersonate", () => {
  it("is disabled when admin features are off", async () => {
    adminEnabled.mockReturnValue(false)
    expect((await stopImpersonate()).status).toBe(403)
  })

  it("requires a session that is impersonating", async () => {
    authMock.mockResolvedValue(null as never)
    expect((await stopImpersonate()).status).toBe(401)
    authMock.mockResolvedValue(admin())
    expect((await stopImpersonate()).status).toBe(400)
  })

  it("returns the original user", async () => {
    authMock.mockResolvedValue(
      sessionFor(
        { id: "u2" },
        {
          impersonating: {
            originalUserId: "admin-1",
            originalUsername: "root",
            originalIsAdmin: true,
          },
        }
      )
    )
    expect(await (await stopImpersonate()).json()).toEqual({
      success: true,
      originalUser: { id: "admin-1", username: "root", isAdmin: true },
    })
  })
})

describe("POST /api/admin/mark-old-shows-complete", () => {
  it("rejects an invalid cutoff date", async () => {
    const res = await markOldShowsComplete(post("/x", { cutoffDate: "nope" }))
    expect(res.status).toBe(400)
  })

  it("marks shows before the cutoff complete and lists the rest", async () => {
    db.show.updateMany.mockResolvedValue({ count: 3 })
    db.show.findMany.mockResolvedValue([
      {
        showDate: new Date("2026-01-01T00:00:00Z"),
        venue: "MSG",
        city: "NYC",
        state: "NY",
      },
    ])
    const json = await (
      await markOldShowsComplete(post("/x", { cutoffDate: "2025-12-31" }))
    ).json()
    expect(json).toEqual({
      message: "Marked 3 shows as complete",
      updatedCount: 3,
      remainingIncomplete: [
        { date: "2026-01-01", venue: "MSG", location: "NYC, NY" },
      ],
    })
    expect(
      db.show.updateMany.mock.calls[0][0].where.showDate.lt.toISOString()
    ).toBe("2025-12-31T00:00:00.000Z")
  })

  it("falls back to the default cutoff with no body", async () => {
    db.show.updateMany.mockResolvedValue({ count: 0 })
    db.show.findMany.mockResolvedValue([])
    await markOldShowsComplete(makeRequest("/x", { method: "POST" }))
    expect(
      db.show.updateMany.mock.calls[0][0].where.showDate.lt.toISOString()
    ).toBe("2025-12-27T00:00:00.000Z")
  })

  it("returns 500 on errors", async () => {
    db.show.updateMany.mockRejectedValue(new Error("x"))
    expect((await markOldShowsComplete(post("/x", {}))).status).toBe(500)
  })
})

describe("POST /api/admin/reset-show", () => {
  it("requires showId and an existing show", async () => {
    expect((await resetShow(post("/x", {}))).status).toBe(400)
    db.show.findUnique.mockResolvedValue(null)
    expect((await resetShow(post("/x", { showId: "s" }))).status).toBe(404)
  })

  it("resets picks, submissions, and the show", async () => {
    db.show.findUnique.mockResolvedValue({
      submissions: [{ id: "a" }, { id: "b" }],
    })
    const json = await (await resetShow(post("/x", { showId: "s" }))).json()
    expect(json).toEqual({
      success: true,
      message: "Show reset successfully",
      submissionsReset: 2,
    })
    expect(db.pick.updateMany).toHaveBeenCalledTimes(2)
    expect(db.submission.update.mock.calls[0][0].data).toEqual({
      totalPoints: 0,
      lastSongCount: 0,
      isScored: false,
    })
    expect(db.show.update.mock.calls[0][0].data.isComplete).toBe(false)
  })

  it("returns the error message on failure", async () => {
    db.show.findUnique.mockRejectedValueOnce(new Error("bad"))
    expect(
      (await (await resetShow(post("/x", { showId: "s" }))).json()).error
    ).toBe("bad")
    db.show.findUnique.mockRejectedValueOnce(0)
    expect(
      (await (await resetShow(post("/x", { showId: "s" }))).json()).error
    ).toBe("Reset failed")
  })
})

describe("POST /api/admin/set-show-lock-override", () => {
  const show = {
    id: "s",
    isComplete: false,
    showDate: new Date("2025-07-04T00:00:00Z"),
    timezone: null,
    state: "NY",
  }

  it("lets an impersonating admin through", async () => {
    authMock.mockResolvedValue(
      sessionFor(
        { isAdmin: false },
        { impersonating: { originalIsAdmin: true } }
      )
    )
    db.show.findUnique.mockResolvedValue(null)
    expect(
      (await setLockOverride(post("/x", { showId: "s", lockTime: null })))
        .status
    ).toBe(404)
  })

  it("validates input", async () => {
    const res = await setLockOverride(
      post("/x", { showId: "s", lockTime: "bad" })
    )
    expect(res.status).toBe(400)
  })

  it("refuses to change completed shows", async () => {
    db.show.findUnique.mockResolvedValue({ ...show, isComplete: true })
    const res = await setLockOverride(
      post("/x", { showId: "s", lockTime: null })
    )
    expect(res.status).toBe(400)
  })

  it("sets an override", async () => {
    db.show.findUnique.mockResolvedValue(show)
    db.show.update.mockResolvedValue({ id: "s" })
    const lockTime = "2025-07-04T20:00:00.000Z"
    const json = await (
      await setLockOverride(post("/x", { showId: "s", lockTime }))
    ).json()
    expect(json).toEqual({ success: true, show: { id: "s" } })
    expect(db.show.update.mock.calls[0][0].data).toEqual({
      lockTime: new Date(lockTime),
      lockTimeOverride: new Date(lockTime),
    })
  })

  it("clears an override back to 7 PM venue time", async () => {
    db.show.findUnique.mockResolvedValue(show)
    await setLockOverride(post("/x", { showId: "s", lockTime: null }))
    const data = db.show.update.mock.calls[0][0].data
    expect(data.lockTimeOverride).toBeNull()
    expect(data.lockTime.toISOString()).toBe("2025-07-04T23:00:00.000Z")
  })

  it("uses the stored timezone when present", async () => {
    db.show.findUnique.mockResolvedValue({
      ...show,
      timezone: "America/Denver",
    })
    await setLockOverride(post("/x", { showId: "s", lockTime: null }))
    expect(db.show.update.mock.calls[0][0].data.lockTime.toISOString()).toBe(
      "2025-07-05T01:00:00.000Z"
    )
  })

  it("returns 500 on errors", async () => {
    db.show.findUnique.mockRejectedValue(new Error("x"))
    expect(
      (await setLockOverride(post("/x", { showId: "s", lockTime: null })))
        .status
    ).toBe(500)
  })
})

describe("POST /api/admin/set-show-set-count", () => {
  const startedMock = vi.mocked(hasShowStarted)
  const show = {
    id: "s1",
    showDate: new Date("2030-07-04T00:00:00Z"),
    timezone: "America/New_York",
    state: "NY",
    lockTime: new Date("2030-07-04T23:00:00Z"),
    isComplete: false,
    setCount: 1,
  }
  // A one-set submission: one opener, one encore, 11 regular picks
  const oneSetSubmission = {
    picks: [
      { pickType: "OPENER", openerSet: 1 },
      { pickType: "ENCORE", openerSet: null },
      ...Array.from({ length: 11 }, () => ({
        pickType: "REGULAR",
        openerSet: null,
      })),
    ],
  }
  const setCount = (body: unknown) =>
    setSetCount(post("/api/admin/set-show-set-count", body))

  beforeEach(() => {
    startedMock.mockResolvedValue(false)
    db.show.findUnique.mockResolvedValue(show)
    db.submission.findMany.mockResolvedValue([])
  })

  it.each([0, 4, 1.5])("rejects set count %s", async (value) => {
    const res = await setCount({ showId: "s1", setCount: value })
    expect(res.status).toBe(400)
    expect(db.show.findUnique).not.toHaveBeenCalled()
  })

  it("404s an unknown show", async () => {
    db.show.findUnique.mockResolvedValue(null)
    expect((await setCount({ showId: "s1", setCount: 2 })).status).toBe(404)
  })

  it("refuses completed shows", async () => {
    db.show.findUnique.mockResolvedValue({ ...show, isComplete: true })
    const res = await setCount({ showId: "s1", setCount: 2 })
    expect(res.status).toBe(400)
    expect((await res.json()).error).toContain("completed show")
  })

  it("refuses once the stored lock time has passed", async () => {
    db.show.findUnique.mockResolvedValue({
      ...show,
      lockTime: new Date(Date.now() - 60_000),
    })
    const res = await setCount({ showId: "s1", setCount: 2 })
    expect(res.status).toBe(400)
    expect((await res.json()).error).toContain("already locked")
    expect(db.show.update).not.toHaveBeenCalled()
  })

  it("refuses once the setlist has started, like /api/picks", async () => {
    startedMock.mockResolvedValue(true)
    const res = await setCount({ showId: "s1", setCount: 2 })
    expect(res.status).toBe(400)
    expect(startedMock).toHaveBeenCalledWith(
      "2030-07-04",
      "America/New_York",
      "NY"
    )
    expect(db.show.update).not.toHaveBeenCalled()
  })

  it("raises the set count and reports submissions that need updating", async () => {
    db.submission.findMany.mockResolvedValue([oneSetSubmission])
    const res = await setCount({ showId: "s1", setCount: 2 })
    expect(await res.json()).toEqual({
      success: true,
      show: { id: "s1", setCount: 2 },
      submissionsNeedingUpdate: 1,
    })
    expect(db.show.update).toHaveBeenCalledWith({
      where: { id: "s1" },
      data: { setCount: 2 },
    })
  })

  it("lowers the set count only while nobody has picked", async () => {
    db.show.findUnique.mockResolvedValue({ ...show, setCount: 3 })
    db.show.updateMany.mockResolvedValue({ count: 1 })
    const res = await setCount({ showId: "s1", setCount: 2 })
    expect(res.status).toBe(200)
    expect(db.show.updateMany).toHaveBeenCalledWith({
      where: { id: "s1", isComplete: false, submissions: { none: {} } },
      data: { setCount: 2 },
    })
  })

  it("409s lowering once someone has picked", async () => {
    db.show.findUnique.mockResolvedValue({ ...show, setCount: 3 })
    db.show.updateMany.mockResolvedValue({ count: 0 })
    const res = await setCount({ showId: "s1", setCount: 2 })
    expect(res.status).toBe(409)
    expect((await res.json()).error).toContain("can only go up")
  })

  it("leaves an unchanged set count alone", async () => {
    db.submission.findMany.mockResolvedValue([oneSetSubmission])
    const json = await (await setCount({ showId: "s1", setCount: 1 })).json()
    expect(json.submissionsNeedingUpdate).toBe(0)
    expect(db.show.update).not.toHaveBeenCalled()
    expect(db.show.updateMany).not.toHaveBeenCalled()
  })

  it("returns 500 on unexpected errors", async () => {
    db.show.findUnique.mockRejectedValue(new Error("db"))
    expect((await setCount({ showId: "s1", setCount: 2 })).status).toBe(500)
  })
})

describe("POST /api/admin/test-push", () => {
  it("requires at least one subscription", async () => {
    db.pushSubscription.findMany.mockResolvedValue([])
    expect((await testPush()).status).toBe(400)
  })

  it("counts sends and removes expired subscriptions", async () => {
    db.pushSubscription.findMany.mockResolvedValue([
      { id: "a" },
      { id: "b" },
      { id: "c" },
    ])
    vi.mocked(sendPushNotification)
      .mockResolvedValueOnce({ success: true, expired: false })
      .mockResolvedValueOnce({ success: false, expired: true })
      .mockResolvedValueOnce({ success: false, expired: false })
    expect(await (await testPush()).json()).toEqual({
      success: true,
      sent: 1,
      failed: 2,
    })
    expect(db.pushSubscription.delete).toHaveBeenCalledWith({
      where: { id: "b" },
    })
  })

  it("returns the error message on failure", async () => {
    db.pushSubscription.findMany.mockRejectedValueOnce(new Error("bad"))
    expect((await (await testPush()).json()).error).toBe("bad")
    authMock.mockRejectedValueOnce(0)
    expect((await (await testPush()).json()).error).toBe("Test push failed")
  })
})

describe("POST /api/admin/test-reminders", () => {
  it("sends reminders to everyone, or just the admin on a dry run", async () => {
    vi.mocked(sendPickReminders).mockResolvedValue({ sent: 1 } as never)
    expect(await (await testReminders(post("/x", {}))).json()).toEqual({
      success: true,
      sent: 1,
    })
    expect(sendPickReminders).toHaveBeenLastCalledWith(undefined)

    await testReminders(post("/x", { dryRunSelf: true }))
    expect(sendPickReminders).toHaveBeenLastCalledWith({
      dryRunUserId: "admin-1",
    })

    await testReminders(makeRequest("/x", { method: "POST" }))
    expect(sendPickReminders).toHaveBeenLastCalledWith(undefined)
  })

  it("returns the error message on failure", async () => {
    vi.mocked(sendPickReminders).mockRejectedValueOnce(new Error("bad"))
    expect((await (await testReminders(post("/x", {}))).json()).error).toBe(
      "bad"
    )
    vi.mocked(sendPickReminders).mockRejectedValueOnce(0)
    expect((await (await testReminders(post("/x", {}))).json()).error).toBe(
      "Test reminder send failed"
    )
  })
})

describe("GET /api/admin/users", () => {
  it("is disabled when admin features are off", async () => {
    adminEnabled.mockReturnValue(false)
    expect((await listUsers()).status).toBe(403)
  })

  it("requires a session and a database-confirmed admin", async () => {
    authMock.mockResolvedValue(null as never)
    expect((await listUsers()).status).toBe(401)
    authMock.mockResolvedValue(admin())
    db.user.findUnique.mockResolvedValue({ isAdmin: false })
    expect((await listUsers()).status).toBe(403)
  })

  it("lists everyone except the original admin", async () => {
    authMock.mockResolvedValue(
      sessionFor({ id: "u2" }, { impersonating: { originalUserId: "admin-1" } })
    )
    db.user.findUnique.mockResolvedValue({ isAdmin: true })
    db.user.findMany.mockResolvedValue([{ id: "u3" }])
    expect(await (await listUsers()).json()).toEqual({ users: [{ id: "u3" }] })
    expect(db.user.findMany.mock.calls[0][0].where).toEqual({
      id: { not: "admin-1" },
    })
  })
})
