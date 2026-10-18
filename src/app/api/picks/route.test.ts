import { describe, it, expect, vi, beforeEach } from "vitest"

vi.mock("@/lib/prisma", async () => {
  const { createPrismaMock } = await import("@/test-utils/prisma-mock")
  return { prisma: createPrismaMock() }
})
vi.mock("@/lib/auth", () => ({ auth: vi.fn() }))
vi.mock("@/lib/phishnet", () => ({ hasShowStarted: vi.fn() }))

import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { hasShowStarted } from "@/lib/phishnet"
import { resetPrismaMock, type PrismaMock } from "@/test-utils/prisma-mock"
import { makeRequest, sessionFor } from "@/test-utils/request"
import { GET, POST } from "./route"

const db = prisma as unknown as PrismaMock
const authMock = vi.mocked(auth)
const startedMock = vi.mocked(hasShowStarted)

function validPicks() {
  return [
    { songId: "o", pickType: "OPENER" },
    { songId: "e", pickType: "ENCORE" },
    ...Array.from({ length: 11 }, (_, i) => ({
      songId: `r${i}`,
      pickType: "REGULAR",
    })),
  ]
}

const show = {
  id: "show-1",
  showDate: new Date("2025-07-04T00:00:00Z"),
  timezone: null,
  state: "NY",
  lockTime: null,
  // One set: one opener, one encore, 11 regular picks (validPicks())
  setCount: 1,
}

function post(body: unknown) {
  return POST(makeRequest("/api/picks", { method: "POST", body }))
}

beforeEach(() => {
  resetPrismaMock(db)
  authMock.mockReset()
  authMock.mockResolvedValue(sessionFor())
  startedMock.mockReset()
  startedMock.mockResolvedValue(false)
  vi.spyOn(console, "error").mockImplementation(() => {})
})

describe("GET /api/picks", () => {
  it("requires a session", async () => {
    authMock.mockResolvedValue(null as never)
    const res = await GET(makeRequest("/api/picks?showId=s"))
    expect(res.status).toBe(401)
  })

  it("requires showId", async () => {
    const res = await GET(makeRequest("/api/picks"))
    expect(res.status).toBe(400)
  })

  it("returns the user's submission", async () => {
    db.submission.findUnique.mockResolvedValue({ id: "sub-1" })
    const res = await GET(makeRequest("/api/picks?showId=show-1"))
    expect(await res.json()).toEqual({ submission: { id: "sub-1" } })
    expect(db.submission.findUnique.mock.calls[0][0].where).toEqual({
      userId_showId: { userId: "user-1", showId: "show-1" },
    })
  })

  it("returns 500 on database errors", async () => {
    db.submission.findUnique.mockRejectedValue(new Error("boom"))
    const res = await GET(makeRequest("/api/picks?showId=show-1"))
    expect(res.status).toBe(500)
  })
})

describe("POST /api/picks", () => {
  it("requires a session", async () => {
    authMock.mockResolvedValue(null as never)
    expect((await post({})).status).toBe(401)
  })

  it("rejects malformed bodies with the zod message", async () => {
    const res = await post({ showId: 1 })
    expect(res.status).toBe(400)
    expect((await res.json()).error).toBeTruthy()
  })

  it.each([
    [
      "opener",
      (p: ReturnType<typeof validPicks>) => p.slice(1),
      "exactly 1 opener",
    ],
    [
      "encore",
      (p: ReturnType<typeof validPicks>) =>
        p.filter((x) => x.pickType !== "ENCORE"),
      "exactly 1 encore",
    ],
    [
      "regular",
      (p: ReturnType<typeof validPicks>) => p.slice(0, 5),
      "exactly 11 regular",
    ],
  ])("enforces the %s count", async (_label, mutate, message) => {
    db.show.findUnique.mockResolvedValue(show)
    const res = await post({ showId: "show-1", picks: mutate(validPicks()) })
    expect(res.status).toBe(400)
    expect((await res.json()).error).toContain(message)
  })

  it("validates the opener count against the show's set count", async () => {
    db.show.findUnique.mockResolvedValue({ ...show, setCount: 2 })
    const res = await post({ showId: "show-1", picks: validPicks() })
    expect(res.status).toBe(400)
    expect((await res.json()).error).toContain("exactly 2 openers")
  })

  it("rejects duplicate songs", async () => {
    db.show.findUnique.mockResolvedValue(show)
    const picks = validPicks()
    picks[2].songId = "o"
    const res = await post({ showId: "show-1", picks })
    expect((await res.json()).error).toContain("same song twice")
  })

  it("404s for an unknown show", async () => {
    db.show.findUnique.mockResolvedValue(null)
    const res = await post({ showId: "show-1", picks: validPicks() })
    expect(res.status).toBe(404)
  })

  it("rejects submissions once the show has started", async () => {
    db.show.findUnique.mockResolvedValue(show)
    startedMock.mockResolvedValue(true)
    const res = await post({ showId: "show-1", picks: validPicks() })
    expect(res.status).toBe(400)
    expect((await res.json()).error).toContain("already started")
    expect(startedMock).toHaveBeenCalledWith("2025-07-04", null, "NY")
  })

  it("creates a new submission and backfills the lock time", async () => {
    db.show.findUnique.mockResolvedValue(show)
    db.submission.findUnique.mockResolvedValue(null)
    db.submission.create.mockResolvedValue({ id: "sub-new" })

    const res = await post({ showId: "show-1", picks: validPicks() })
    const json = await res.json()

    expect(json).toMatchObject({
      success: true,
      submission: { id: "sub-new" },
      message: "Picks submitted successfully!",
    })
    expect(db.show.update.mock.calls[0][0].data.timezone).toBe(
      "America/New_York"
    )
    expect(
      db.submission.create.mock.calls[0][0].data.picks.create
    ).toHaveLength(13)
  })

  it("replaces picks on an existing submission", async () => {
    db.show.findUnique.mockResolvedValue({
      ...show,
      lockTime: new Date("2025-07-04T23:00:00Z"),
    })
    db.submission.findUnique
      .mockResolvedValueOnce({ id: "sub-1" })
      .mockResolvedValueOnce({ id: "sub-1", picks: [] })

    const json = await (
      await post({ showId: "show-1", picks: validPicks() })
    ).json()

    expect(json.message).toBe("Picks updated successfully!")
    expect(db.show.update).not.toHaveBeenCalled()
    expect(db.pick.deleteMany).toHaveBeenCalledWith({
      where: { submissionId: "sub-1" },
    })
    expect(db.pick.createMany.mock.calls[0][0].data).toHaveLength(13)
  })

  it("uses the show's stored timezone when backfilling lock time", async () => {
    db.show.findUnique.mockResolvedValue({
      ...show,
      timezone: "America/Denver",
      state: null,
    })
    db.submission.findUnique.mockResolvedValue(null)
    await post({ showId: "show-1", picks: validPicks() })
    expect(db.show.update.mock.calls[0][0].data.timezone).toBe("America/Denver")
  })

  it("returns 500 on unexpected errors", async () => {
    db.show.findUnique.mockRejectedValue(new Error("db"))
    const res = await post({ showId: "show-1", picks: validPicks() })
    expect(res.status).toBe(500)
  })
})
