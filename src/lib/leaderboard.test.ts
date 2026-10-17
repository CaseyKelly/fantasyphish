import { describe, it, expect, vi, beforeEach } from "vitest"

// leaderboard.ts imports @/lib/prisma (and transitively @/lib/db-retry) at
// module load; mock prisma out since these two where-clause builders never
// touch it at runtime.
vi.mock("@/lib/prisma", async () => {
  const { createPrismaMock } = await import("@/test-utils/prisma-mock")
  return { prisma: createPrismaMock() }
})

import { prisma } from "@/lib/prisma"
import { resetPrismaMock, type PrismaMock } from "@/test-utils/prisma-mock"
import {
  tourSubmissionWhere,
  showSubmissionWhere,
  getLeaderboard,
  getCurrentOrLastShow,
} from "./leaderboard"

const db = prisma as unknown as PrismaMock

beforeEach(() => {
  resetPrismaMock(db)
})

describe("tourSubmissionWhere", () => {
  it("builds the no-tour OR branch (all scored, or locked-in-unscored) plus the test-venue exclusion", () => {
    const where = tourSubmissionWhere(undefined)
    expect(where.OR).toHaveLength(2)
    expect(where.OR).toContainEqual({ isScored: true })
    expect(where.OR?.[1]).toMatchObject({ isScored: false })
    expect(where.NOT).toEqual({ show: { venue: { contains: "Test Venue" } } })
  })

  it("scopes both OR branches to the given tour when tourId is provided", () => {
    const where = tourSubmissionWhere("tour-123")
    expect(where.OR).toContainEqual({
      isScored: true,
      show: { tourId: "tour-123" },
    })
    expect(where.OR?.[1]).toMatchObject({
      isScored: false,
      show: expect.objectContaining({ tourId: "tour-123" }),
    })
    expect(where.NOT).toEqual({ show: { venue: { contains: "Test Venue" } } })
  })
})

describe("showSubmissionWhere", () => {
  it("scopes to the given show and includes the same OR/NOT structure", () => {
    const where = showSubmissionWhere("show-456")
    expect(where.showId).toBe("show-456")
    expect(where.OR).toHaveLength(2)
    expect(where.OR).toContainEqual({ isScored: true })
    expect(where.OR?.[1]).toMatchObject({ isScored: false })
    expect(where.NOT).toEqual({ show: { venue: { contains: "Test Venue" } } })
  })
})

describe("getLeaderboard", () => {
  function sub(
    showId: string,
    showDate: string,
    totalPoints: number | null,
    played: (boolean | null)[]
  ) {
    return {
      totalPoints,
      show: {
        id: showId,
        showDate: new Date(showDate),
        venue: "V",
        city: null,
        state: null,
      },
      picks: played.map((wasPlayed, i) => ({
        wasPlayed,
        pointsEarned: wasPlayed ? 1 : null,
        pickType: "REGULAR",
        song: { name: `Song ${i}` },
      })),
    }
  }

  it("totals, averages, ranks with ties, and sorts picks newest show first", async () => {
    db.user.findMany.mockResolvedValue([
      {
        id: "u1",
        username: "alice",
        submissions: [
          sub("s1", "2025-07-01", 5, [true, true, false]),
          sub("s2", "2025-07-02", 4, [true]),
        ],
      },
      {
        id: "u2",
        username: "bob",
        submissions: [sub("s1", "2025-07-01", 9, [])],
      },
      {
        id: "u3",
        username: "carol",
        submissions: [sub("s1", "2025-07-01", null, [null])],
      },
    ])
    // Streak lookups: locked shows + all submissions
    db.show.findMany.mockResolvedValue([
      { id: "s1" },
      { id: "s2" },
      { id: "s3" },
    ])
    db.submission.findMany.mockResolvedValue([
      { userId: "u1", showId: "s1" },
      { userId: "u1", showId: "s2" },
      { userId: "u1", showId: "s3" },
      { userId: "u2", showId: "s3" },
    ])

    const board = await getLeaderboard({}, "test")

    expect(board.map((e) => [e.username, e.totalPoints, e.rank])).toEqual([
      ["alice", 9, 1],
      ["bob", 9, 1],
      ["carol", 0, 3],
    ])
    const alice = board[0]
    expect(alice.showsPlayed).toBe(2)
    expect(alice.avgPoints).toBe(4.5)
    expect(alice.accuracy).toBe(Math.round((3 / 26) * 100))
    expect(alice.showStreak).toBe(3)
    expect(alice.picksByShow.map((p) => p.show.id)).toEqual(["s2", "s1"])
    expect(alice.picksByShow[1].picks[2]).toEqual({
      songName: "Song 2",
      wasPlayed: false,
      pointsEarned: 0,
      pickType: "REGULAR",
    })
    expect(board[1].showStreak).toBeNull()
    expect(board[2].picksByShow[0].totalPoints).toBe(0)
  })

  it("handles users with no submissions in scope", async () => {
    db.user.findMany.mockResolvedValue([
      { id: "u1", username: "alice", submissions: [] },
    ])
    db.show.findMany.mockResolvedValue([])
    db.submission.findMany.mockResolvedValue([])
    const [entry] = await getLeaderboard({}, "test")
    expect(entry).toMatchObject({ avgPoints: 0, accuracy: 0, totalPoints: 0 })
  })
})

describe("getCurrentOrLastShow", () => {
  it("filters by tour when given", async () => {
    db.show.findFirst.mockResolvedValue({ id: "s1" })
    expect(await getCurrentOrLastShow("t1")).toEqual({ id: "s1" })
    expect(db.show.findFirst.mock.calls[0][0].where.tourId).toBe("t1")
  })

  it("searches all tours without a tourId", async () => {
    db.show.findFirst.mockResolvedValue(null)
    expect(await getCurrentOrLastShow()).toBeNull()
    expect(db.show.findFirst.mock.calls[0][0].where).not.toHaveProperty(
      "tourId"
    )
  })
})
