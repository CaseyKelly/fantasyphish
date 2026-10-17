import { describe, it, expect, vi, beforeEach } from "vitest"

// streaks.ts imports @/lib/prisma at module load; computeStreaks is pure and
// never touches it.
vi.mock("@/lib/prisma", async () => {
  const { createPrismaMock } = await import("@/test-utils/prisma-mock")
  return { prisma: createPrismaMock() }
})

import { prisma } from "@/lib/prisma"
import { resetPrismaMock, type PrismaMock } from "@/test-utils/prisma-mock"
import {
  buildStreakMap,
  computeStreaks,
  isTestVenue,
  getLockedShowIds,
  getStreaksForUsers,
  getStreaksForAllUsers,
} from "./streaks"

const db = prisma as unknown as PrismaMock

beforeEach(() => {
  resetPrismaMock(db)
})

const shows = ["s1", "s2", "s3", "s4", "s5", "s6"]

describe("computeStreaks", () => {
  it("returns zeros when the user has never submitted", () => {
    expect(computeStreaks(shows, new Set())).toEqual({ current: 0, best: 0 })
  })

  it("returns zeros when no shows have locked yet", () => {
    expect(computeStreaks([], new Set(["s1"]))).toEqual({ current: 0, best: 0 })
  })

  it("counts every show when the user never missed", () => {
    expect(computeStreaks(shows, new Set(shows))).toEqual({
      current: 6,
      best: 6,
    })
  })

  it("counts the current run back from the most recent locked show", () => {
    expect(computeStreaks(shows, new Set(["s1", "s4", "s5", "s6"]))).toEqual({
      current: 3,
      best: 3,
    })
  })

  it("resets current to 0 when the most recent locked show was missed but keeps best", () => {
    expect(computeStreaks(shows, new Set(["s1", "s2", "s3", "s4"]))).toEqual({
      current: 0,
      best: 4,
    })
  })

  it("keeps the longest earlier run as best when the current run is shorter", () => {
    expect(
      computeStreaks(shows, new Set(["s1", "s2", "s3", "s5", "s6"]))
    ).toEqual({ current: 2, best: 3 })
  })

  it("ignores submissions for shows that aren't in the locked list (e.g. tonight's unlocked show)", () => {
    expect(computeStreaks(["s1", "s2"], new Set(["s1", "s2", "s3"]))).toEqual({
      current: 2,
      best: 2,
    })
  })
})

describe("isTestVenue", () => {
  it("flags test-fixture venues and passes real ones", () => {
    expect(isTestVenue("Test Venue 42")).toBe(true)
    expect(isTestVenue("Madison Square Garden")).toBe(false)
  })
})

describe("buildStreakMap", () => {
  it("groups submissions per user and zero-fills requested users with none", () => {
    const map = buildStreakMap(
      ["s1", "s2", "s3"],
      [
        { userId: "a", showId: "s1" },
        { userId: "a", showId: "s2" },
        { userId: "a", showId: "s3" },
        { userId: "b", showId: "s1" },
        { userId: "b", showId: "s3" },
      ],
      ["a", "b", "c"]
    )
    expect(map.get("a")).toEqual({ current: 3, best: 3 })
    expect(map.get("b")).toEqual({ current: 1, best: 1 })
    expect(map.get("c")).toEqual({ current: 0, best: 0 })
  })

  it("only includes the requested users", () => {
    const map = buildStreakMap(["s1"], [{ userId: "a", showId: "s1" }], [])
    expect(map.size).toBe(0)
  })
})

describe("getLockedShowIds", () => {
  it("queries locked, non-test shows oldest first", async () => {
    const now = new Date("2025-07-04T00:00:00Z")
    db.show.findMany.mockResolvedValue([{ id: "s1" }, { id: "s2" }])
    expect(await getLockedShowIds(now)).toEqual(["s1", "s2"])
    expect(db.show.findMany.mock.calls[0][0]).toMatchObject({
      where: { lockTime: { lte: now } },
      orderBy: { showDate: "asc" },
    })
  })
})

describe("getStreaksForUsers", () => {
  it("returns an empty map without querying when given no users", async () => {
    expect((await getStreaksForUsers([])).size).toBe(0)
    expect(db.show.findMany).not.toHaveBeenCalled()
  })

  it("computes a streak per requested user", async () => {
    db.show.findMany.mockResolvedValue([{ id: "s1" }, { id: "s2" }])
    db.submission.findMany.mockResolvedValue([
      { userId: "u1", showId: "s1" },
      { userId: "u1", showId: "s2" },
    ])
    const map = await getStreaksForUsers(["u1", "u2"])
    expect(map.get("u1")).toEqual({ current: 2, best: 2 })
    expect(map.get("u2")).toEqual({ current: 0, best: 0 })
    expect(db.submission.findMany.mock.calls[0][0].where).toEqual({
      userId: { in: ["u1", "u2"] },
    })
  })
})

describe("getStreaksForAllUsers", () => {
  it("includes every user who has submitted", async () => {
    db.show.findMany.mockResolvedValue([{ id: "s1" }])
    db.submission.findMany.mockResolvedValue([
      { userId: "u1", showId: "s1" },
      { userId: "u2", showId: "other" },
    ])
    const map = await getStreaksForAllUsers()
    expect([...map.keys()].sort()).toEqual(["u1", "u2"])
    expect(map.get("u1")).toEqual({ current: 1, best: 1 })
  })
})
