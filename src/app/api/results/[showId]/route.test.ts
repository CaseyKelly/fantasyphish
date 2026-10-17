import { describe, it, expect, vi, beforeEach } from "vitest"

vi.mock("@/lib/prisma", async () => {
  const { createPrismaMock } = await import("@/test-utils/prisma-mock")
  return { prisma: createPrismaMock() }
})
vi.mock("@/lib/auth", () => ({ auth: vi.fn() }))

import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { resetPrismaMock, type PrismaMock } from "@/test-utils/prisma-mock"
import { makeRequest, routeParams, sessionFor } from "@/test-utils/request"
import { GET } from "./route"

const db = prisma as unknown as PrismaMock
const authMock = vi.mocked(auth)

const baseShow = {
  id: "show-1",
  venue: "MSG",
  city: "New York",
  state: "NY",
  showDate: new Date("2025-07-04T00:00:00Z"),
  isComplete: true,
  lockTime: null,
  lastScoredAt: null,
  setlistJson: null,
  submissions: [
    {
      id: "sub-1",
      totalPoints: 5,
      isScored: true,
      user: { username: "alice" },
      picks: [
        {
          id: "p1",
          song: { name: "Tweezer" },
          pickType: "OPENER",
          wasPlayed: true,
          pointsEarned: 3,
        },
      ],
    },
  ],
}

function get(url = "/api/results/show-1") {
  return GET(makeRequest(url), routeParams({ showId: "show-1" }))
}

beforeEach(() => {
  resetPrismaMock(db)
  authMock.mockReset()
  authMock.mockResolvedValue(sessionFor())
  vi.spyOn(console, "error").mockImplementation(() => {})
})

describe("GET /api/results/[showId]", () => {
  it("requires a session", async () => {
    authMock.mockResolvedValue(null as never)
    expect((await get()).status).toBe(401)
  })

  it("404s for unknown shows", async () => {
    db.show.findUnique.mockResolvedValue(null)
    expect((await get()).status).toBe(404)
  })

  it("hides test shows from non-admins but not admins", async () => {
    db.show.findUnique.mockResolvedValue({ ...baseShow, venue: "Test Venue" })
    expect((await get()).status).toBe(404)
    authMock.mockResolvedValue(sessionFor({ isAdmin: true }))
    expect((await get()).status).toBe(200)
  })

  it("404s when the user has no submission", async () => {
    db.show.findUnique.mockResolvedValue({ ...baseShow, submissions: [] })
    const res = await get()
    expect(res.status).toBe(404)
    expect((await res.json()).error).toContain("No submission")
  })

  it("returns picks without a setlist when none is stored", async () => {
    db.show.findUnique.mockResolvedValue(baseShow)
    const json = await (await get()).json()
    expect(json.setlist).toBeNull()
    expect(json.submission).toEqual({
      id: "sub-1",
      totalPoints: 5,
      isScored: true,
      username: "alice",
      picks: [
        {
          id: "p1",
          song: "Tweezer",
          pickType: "OPENER",
          wasPlayed: true,
          pointsEarned: 3,
        },
      ],
    })
    expect(
      db.show.findUnique.mock.calls[0][0].include.submissions.where
    ).toEqual({ userId: "user-1" })
  })

  it("strips HTML from the stored setlist and supports admin submissionId lookups", async () => {
    db.show.findUnique.mockResolvedValue({
      ...baseShow,
      setlistJson: {
        setlistnotes: "<p>Great &amp; long</p>",
        songs: [
          { song: "Tweezer", set: "1", position: 1, footnote: "<b>tease</b>" },
        ],
      },
    })
    const json = await (
      await get("/api/results/show-1?submissionId=sub-9")
    ).json()
    expect(json.setlist).toEqual({
      setlistNotes: "Great & long",
      songs: [{ song: "Tweezer", set: "1", position: 1, footnote: "tease" }],
    })
    expect(
      db.show.findUnique.mock.calls[0][0].include.submissions.where
    ).toEqual({ id: "sub-9" })
  })

  it("returns 500 on errors", async () => {
    db.show.findUnique.mockRejectedValue(new Error("x"))
    expect((await get()).status).toBe(500)
  })
})
