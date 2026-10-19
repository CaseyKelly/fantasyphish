import { describe, it, expect, vi, beforeEach } from "vitest"

// admin-usage.ts imports @/lib/prisma at module load; mock it out since
// pctOf never touches prisma at runtime.
vi.mock("@/lib/prisma", async () => {
  const { createPrismaMock } = await import("@/test-utils/prisma-mock")
  return { prisma: createPrismaMock() }
})

import { prisma } from "@/lib/prisma"
import { resetPrismaMock, type PrismaMock } from "@/test-utils/prisma-mock"
import {
  pctOf,
  getUsageOverview,
  getUserEngagementRows,
  getShowParticipation,
  getAchievementDistribution,
  getDonutLeaderboard,
  getStreakLeaderboard,
} from "./admin-usage"

const db = prisma as unknown as PrismaMock

beforeEach(() => {
  resetPrismaMock(db)
})

describe("pctOf", () => {
  it("returns 0 when total is 0 (no divide-by-zero)", () => {
    expect(pctOf(5, 0)).toBe(0)
  })

  it("rounds to the nearest whole percent", () => {
    expect(pctOf(1, 3)).toBe(33)
  })

  it("rounds .5 up", () => {
    expect(pctOf(1, 8)).toBe(13) // 12.5 -> 13
  })
})

describe("getUsageOverview", () => {
  it("combines the counts into percentages of total users", async () => {
    db.user.count
      .mockResolvedValueOnce(10) // total
      .mockResolvedValueOnce(8) // verified
      .mockResolvedValueOnce(5) // email opt-in
    db.pushSubscription.groupBy.mockResolvedValue([
      { userId: "a" },
      { userId: "b" },
    ])
    db.easterEggScore.count.mockResolvedValue(3)
    db.submission.count.mockResolvedValue(42)

    expect(await getUsageOverview()).toEqual({
      totalUsers: 10,
      verifiedUsers: 8,
      emailOptInUsers: 5,
      emailOptInPct: 50,
      pushEnabledUsers: 2,
      pushEnabledPct: 20,
      donutPlayers: 3,
      donutPlayersPct: 30,
      totalSubmissions: 42,
    })
  })
})

describe("getUserEngagementRows", () => {
  it("joins last-submission dates and donut scores onto each user", async () => {
    const created = new Date("2025-01-01T00:00:00Z")
    const last = new Date("2025-07-04T00:00:00Z")
    db.user.findMany.mockResolvedValue([
      {
        id: "u1",
        username: "alice",
        email: "a@x.com",
        createdAt: created,
        emailVerified: created,
        isAdmin: true,
        emailPickReminders: true,
        _count: { submissions: 4, achievements: 2, pushSubscriptions: 1 },
      },
      {
        id: "u2",
        username: "bob",
        email: "b@x.com",
        createdAt: created,
        emailVerified: null,
        isAdmin: false,
        emailPickReminders: false,
        _count: { submissions: 0, achievements: 0, pushSubscriptions: 0 },
      },
    ])
    db.submission.groupBy.mockResolvedValue([
      { userId: "u1", _max: { createdAt: last } },
    ])
    db.easterEggScore.findMany.mockResolvedValue([{ userId: "u1", score: 77 }])

    const rows = await getUserEngagementRows()
    expect(rows[0]).toEqual({
      id: "u1",
      username: "alice",
      email: "a@x.com",
      signupDate: created.toISOString(),
      emailVerified: true,
      isAdmin: true,
      emailOptIn: true,
      pushCount: 1,
      submissionCount: 4,
      lastSubmissionDate: last.toISOString(),
      donutScore: 77,
      achievementCount: 2,
    })
    expect(rows[1]).toMatchObject({
      emailVerified: false,
      lastSubmissionDate: null,
      donutScore: null,
    })
  })
})

describe("getShowParticipation", () => {
  it("maps shows with participation percentage and optional tour", async () => {
    const date = new Date("2025-07-04T00:00:00Z")
    db.show.findMany.mockResolvedValue([
      {
        id: "s1",
        showDate: date,
        venue: "MSG",
        isComplete: true,
        tour: { name: "Summer" },
        _count: { submissions: 3 },
      },
      {
        id: "s2",
        showDate: date,
        venue: "Dicks",
        isComplete: false,
        tour: null,
        _count: { submissions: 0 },
      },
    ])
    db.user.count.mockResolvedValue(4)

    expect(await getShowParticipation()).toEqual([
      {
        id: "s1",
        showDate: date.toISOString(),
        venue: "MSG",
        tourName: "Summer",
        isComplete: true,
        submissionCount: 3,
        participationPct: 75,
      },
      {
        id: "s2",
        showDate: date.toISOString(),
        venue: "Dicks",
        tourName: null,
        isComplete: false,
        submissionCount: 0,
        participationPct: 0,
      },
    ])
  })
})

describe("getAchievementDistribution", () => {
  it("counts earners per achievement, rarest first", async () => {
    db.achievement.findMany.mockResolvedValue([
      { id: "a", slug: "a", name: "A", category: "X", icon: "1" },
      { id: "b", slug: "b", name: "B", category: "X", icon: "2" },
      { id: "c", slug: "c", name: "C", category: "X", icon: "3" },
    ])
    db.userAchievement.groupBy.mockResolvedValue([
      { achievementId: "a", _count: { achievementId: 5 } },
      { achievementId: "b", _count: { achievementId: 1 } },
    ])

    const rows = await getAchievementDistribution()
    expect(rows.map((r) => [r.id, r.earnedCount])).toEqual([
      ["c", 0],
      ["b", 1],
      ["a", 5],
    ])
  })
})

describe("getDonutLeaderboard", () => {
  it("flattens username and serializes the date", async () => {
    const at = new Date("2025-07-04T00:00:00Z")
    db.easterEggScore.findMany.mockResolvedValue([
      { userId: "u1", score: 10, updatedAt: at, user: { username: "alice" } },
    ])
    expect(await getDonutLeaderboard()).toEqual([
      {
        userId: "u1",
        username: "alice",
        score: 10,
        achievedAt: at.toISOString(),
      },
    ])
  })
})

describe("getStreakLeaderboard", () => {
  it("drops users without a streak and sorts by current then best", async () => {
    db.show.findMany.mockResolvedValue([
      { id: "s1" },
      { id: "s2" },
      { id: "s3" },
    ])
    db.submission.findMany.mockResolvedValue([
      { userId: "u1", showId: "s1" },
      { userId: "u1", showId: "s2" },
      { userId: "u2", showId: "s3" },
      { userId: "u3", showId: "s1" },
      { userId: "u3", showId: "s3" },
      { userId: "u4", showId: "not-locked" },
    ])
    db.user.findMany.mockResolvedValue([
      { id: "u1", username: "alice" },
      { id: "u2", username: "bob" },
      { id: "u3", username: "carol" },
      { id: "u4", username: "dave" },
      { id: "u5", username: "ghost" },
    ])

    const rows = await getStreakLeaderboard()
    expect(
      rows.map((r) => [r.username, r.currentStreak, r.bestStreak])
    ).toEqual([
      ["bob", 1, 1],
      ["carol", 1, 1],
      ["alice", 0, 2],
    ])
  })
})
