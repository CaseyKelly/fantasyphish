import { describe, it, expect, vi, beforeEach } from "vitest"
import { Prisma } from "@prisma/client"

// Signed-in user endpoints (polls, donut scores, preferences, push) share
// the same auth + achievement mocks, so they're tested together.
vi.mock("@/lib/prisma", async () => {
  const { createPrismaMock } = await import("@/test-utils/prisma-mock")
  return { prisma: createPrismaMock() }
})
vi.mock("@/lib/auth", () => ({ auth: vi.fn() }))
vi.mock("@/lib/achievement-awards", () => ({
  awardSongPickAchievement: vi.fn(async () => ({ awarded: true })),
}))

import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { awardSongPickAchievement } from "@/lib/achievement-awards"
import { resetPrismaMock, type PrismaMock } from "@/test-utils/prisma-mock"
import { makeRequest, routeParams, sessionFor } from "@/test-utils/request"
import { GET as getPoll, POST as votePoll } from "./polls/[slug]/route"
import { GET as getDonut, POST as postDonut } from "./easter-egg/score/route"
import { GET as getPrefs, PATCH as patchPrefs } from "./user/preferences/route"
import {
  POST as subscribe,
  DELETE as unsubscribe,
} from "./push/subscribe/route"

const db = prisma as unknown as PrismaMock
const authMock = vi.mocked(auth)
const awardMock = vi.mocked(awardSongPickAchievement)

const SLUG = "set2-opener-format"

beforeEach(() => {
  resetPrismaMock(db)
  vi.clearAllMocks()
  authMock.mockResolvedValue(sessionFor())
  vi.spyOn(console, "error").mockImplementation(() => {})
})

describe("GET /api/polls/[slug]", () => {
  const get = (slug = SLUG) => getPoll(makeRequest("/x"), routeParams({ slug }))

  it("requires a session and a known poll", async () => {
    authMock.mockResolvedValueOnce(null as never)
    expect((await get()).status).toBe(401)
    expect((await get("nope")).status).toBe(404)
  })

  it("hides results until the user votes", async () => {
    db.pollVote.findUnique.mockResolvedValue(null)
    expect(await (await get()).json()).toEqual({
      userVote: null,
      results: null,
    })
  })

  it("returns the tally after voting", async () => {
    db.pollVote.findUnique.mockResolvedValue({ option: "yes" })
    db.pollVote.groupBy.mockResolvedValue([
      { option: "yes", _count: { _all: 3 } },
      { option: "no", _count: { _all: 1 } },
    ])
    const json = await (await get()).json()
    expect(json.userVote).toBe("yes")
    expect(json.results.totalVotes).toBe(4)
  })

  it("returns 500 on errors", async () => {
    db.pollVote.findUnique.mockRejectedValue(new Error("x"))
    expect((await get()).status).toBe(500)
  })
})

describe("POST /api/polls/[slug]", () => {
  const vote = (body: unknown, slug = SLUG) =>
    votePoll(makeRequest("/x", { method: "POST", body }), routeParams({ slug }))

  it("requires a session and a known poll", async () => {
    authMock.mockResolvedValueOnce(null as never)
    expect((await vote({ option: "yes" })).status).toBe(401)
    expect((await vote({ option: "yes" }, "nope")).status).toBe(404)
  })

  it("validates the option", async () => {
    expect((await vote({ option: "" })).status).toBe(400)
    expect((await (await vote({ option: "maybe" })).json()).error).toBe(
      "Invalid option"
    )
  })

  it("records the vote, awards the achievement, and returns results", async () => {
    db.pollVote.groupBy.mockResolvedValue([
      { option: "yes", _count: { _all: 1 } },
    ])
    const json = await (await vote({ option: "yes" })).json()
    expect(json.userVote).toBe("yes")
    expect(db.pollVote.create).toHaveBeenCalledWith({
      data: { pollSlug: SLUG, userId: "user-1", option: "yes" },
    })
    expect(awardMock).toHaveBeenCalledWith("user-1", "SAMPLE_IN_A_JAR", {
      pollSlug: SLUG,
    })
  })

  it("returns 409 with the original vote on a repeat", async () => {
    db.pollVote.create.mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError("Unique constraint", {
        code: "P2002",
        clientVersion: "test",
      })
    )
    db.pollVote.findUnique.mockResolvedValue({ option: "no" })
    db.pollVote.groupBy.mockResolvedValue([])
    const res = await vote({ option: "yes" })
    expect(res.status).toBe(409)
    expect((await res.json()).userVote).toBe("no")
    expect(awardMock).not.toHaveBeenCalled()
  })

  it("returns 500 on other database errors", async () => {
    db.pollVote.create.mockRejectedValue(new Error("x"))
    expect((await vote({ option: "yes" })).status).toBe(500)
  })
})

describe("GET /api/easter-egg/score", () => {
  it("returns the leaderboard and the signed-in user's best", async () => {
    db.easterEggScore.findMany.mockResolvedValue([
      { score: 30, user: { username: "alice" } },
    ])
    db.easterEggScore.findUnique.mockResolvedValue({ score: 12 })
    expect(await (await getDonut()).json()).toEqual({
      leaderboard: [{ username: "alice", score: 30 }],
      yourBest: 12,
    })
  })

  it("omits a personal best for anonymous users or first-timers", async () => {
    db.easterEggScore.findMany.mockResolvedValue([])
    authMock.mockResolvedValueOnce(null as never)
    expect((await (await getDonut()).json()).yourBest).toBeNull()
    db.easterEggScore.findUnique.mockResolvedValue(null)
    expect((await (await getDonut()).json()).yourBest).toBeNull()
    expect(db.easterEggScore.findUnique).toHaveBeenCalledTimes(1)
  })

  it("returns 500 on errors", async () => {
    db.easterEggScore.findMany.mockRejectedValue(new Error("x"))
    expect((await getDonut()).status).toBe(500)
  })
})

describe("POST /api/easter-egg/score", () => {
  const submit = (body: unknown) =>
    postDonut(makeRequest("/x", { method: "POST", body }))

  it("requires a session and a valid score", async () => {
    authMock.mockResolvedValueOnce(null as never)
    expect((await submit({ score: 5 })).status).toBe(401)
    expect((await submit({ score: -1 })).status).toBe(400)
  })

  it("keeps the existing best when the new score isn't higher", async () => {
    db.easterEggScore.findUnique.mockResolvedValue({ score: 10 })
    expect(await (await submit({ score: 10 })).json()).toEqual({
      score: 10,
      isNewBest: false,
    })
    expect(db.easterEggScore.upsert).not.toHaveBeenCalled()
  })

  it("saves a new best without the achievement below the threshold", async () => {
    db.easterEggScore.findUnique.mockResolvedValue({ score: 3 })
    expect(await (await submit({ score: 5 })).json()).toEqual({
      score: 5,
      isNewBest: true,
      achievementAwarded: false,
    })
    expect(awardMock).not.toHaveBeenCalled()
  })

  it("awards DONUT_DEVOTEE at 20+", async () => {
    db.easterEggScore.findUnique.mockResolvedValue(null)
    const json = await (await submit({ score: 25 })).json()
    expect(json.achievementAwarded).toBe(true)
    expect(awardMock).toHaveBeenCalledWith("user-1", "DONUT_DEVOTEE", {
      score: 25,
    })
  })

  it("returns 500 on errors", async () => {
    db.easterEggScore.findUnique.mockRejectedValue(new Error("x"))
    expect((await submit({ score: 5 })).status).toBe(500)
  })
})

describe("/api/user/preferences", () => {
  const patch = (body: unknown) =>
    patchPrefs(makeRequest("/x", { method: "PATCH", body }))

  it("GET requires a session", async () => {
    authMock.mockResolvedValueOnce(null as never)
    expect((await getPrefs()).status).toBe(401)
  })

  it("GET reports email and push settings", async () => {
    db.user.findUnique.mockResolvedValueOnce({
      emailPickReminders: true,
      _count: { pushSubscriptions: 2 },
    })
    expect(await (await getPrefs()).json()).toEqual({
      emailPickReminders: true,
      hasPushSubscription: true,
    })
    db.user.findUnique.mockResolvedValueOnce(null)
    expect(await (await getPrefs()).json()).toEqual({
      emailPickReminders: false,
      hasPushSubscription: false,
    })
  })

  it("GET returns 500 on errors", async () => {
    db.user.findUnique.mockRejectedValue(new Error("x"))
    expect((await getPrefs()).status).toBe(500)
  })

  it("PATCH requires a session and valid input", async () => {
    authMock.mockResolvedValueOnce(null as never)
    expect((await patch({ emailPickReminders: true })).status).toBe(401)
    expect((await patch({ emailPickReminders: "yes" })).status).toBe(400)
  })

  it("PATCH requires a verified email to turn reminders on", async () => {
    db.user.findUnique.mockResolvedValue({ emailVerified: null })
    const res = await patch({ emailPickReminders: true })
    expect((await res.json()).error).toContain("Verify your email")
    expect(db.user.update).not.toHaveBeenCalled()
  })

  it("PATCH enables reminders and awards ICCULUS", async () => {
    db.user.findUnique.mockResolvedValue({ emailVerified: new Date() })
    expect(await (await patch({ emailPickReminders: true })).json()).toEqual({
      success: true,
      emailPickReminders: true,
    })
    expect(awardMock).toHaveBeenCalledWith("user-1", "ICCULUS")
  })

  it("PATCH disables reminders without checks or awards", async () => {
    await patch({ emailPickReminders: false })
    expect(db.user.findUnique).not.toHaveBeenCalled()
    expect(awardMock).not.toHaveBeenCalled()
  })

  it("PATCH returns 500 on errors", async () => {
    db.user.update.mockRejectedValue(new Error("x"))
    expect((await patch({ emailPickReminders: false })).status).toBe(500)
  })
})

describe("/api/push/subscribe", () => {
  const body = {
    endpoint: "https://push.example/abc",
    keys: { p256dh: "p", auth: "a" },
  }
  const post = (b: unknown) =>
    subscribe(makeRequest("/x", { method: "POST", body: b }))
  const del = (b: unknown) =>
    unsubscribe(makeRequest("/x", { method: "DELETE", body: b }))

  it("requires a session", async () => {
    authMock.mockResolvedValue(null as never)
    expect((await post(body)).status).toBe(401)
    expect((await del({ endpoint: body.endpoint })).status).toBe(401)
  })

  it("validates input", async () => {
    expect((await post({ endpoint: "not-a-url" })).status).toBe(400)
    expect((await del({})).status).toBe(400)
  })

  it("upserts the subscription for the user and awards ICCULUS", async () => {
    expect(await (await post(body)).json()).toEqual({ success: true })
    expect(db.pushSubscription.upsert.mock.calls[0][0]).toMatchObject({
      where: { endpoint: body.endpoint },
      create: { userId: "user-1", p256dh: "p", auth: "a" },
    })
    expect(awardMock).toHaveBeenCalledWith("user-1", "ICCULUS")
  })

  it("only deletes the user's own subscription", async () => {
    await del({ endpoint: body.endpoint })
    expect(db.pushSubscription.deleteMany).toHaveBeenCalledWith({
      where: { endpoint: body.endpoint, userId: "user-1" },
    })
  })

  it("returns 500 on errors", async () => {
    db.pushSubscription.upsert.mockRejectedValue(new Error("x"))
    db.pushSubscription.deleteMany.mockRejectedValue(new Error("x"))
    expect((await post(body)).status).toBe(500)
    expect((await del({ endpoint: body.endpoint })).status).toBe(500)
  })
})
