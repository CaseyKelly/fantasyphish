import { describe, it, expect, vi, beforeEach } from "vitest"

// achievement-awards.ts imports @/lib/prisma at module load, which would
// construct a real PrismaClient. Swap in the shared mock instead. Vitest
// hoists vi.mock above the imports below.
vi.mock("@/lib/prisma", async () => {
  const { createPrismaMock } = await import("@/test-utils/prisma-mock")
  return { prisma: createPrismaMock() }
})

import { prisma } from "@/lib/prisma"
import { resetPrismaMock, type PrismaMock } from "@/test-utils/prisma-mock"
import {
  sanitizeTourName,
  getPlacementSuffix,
  awardPickAchievement,
  awardSongPickAchievement,
  awardTourPlacementAchievement,
  processPickAchievements,
} from "./achievement-awards"

const db = prisma as unknown as PrismaMock

beforeEach(() => {
  resetPrismaMock(db)
  vi.spyOn(console, "log").mockImplementation(() => {})
  vi.spyOn(console, "error").mockImplementation(() => {})
})

describe("sanitizeTourName", () => {
  it("lowercases and replaces non-alphanumeric runs with a single hyphen", () => {
    expect(sanitizeTourName("Summer Tour 2025!")).toBe("summer-tour-2025")
  })

  it("strips leading/trailing hyphens", () => {
    expect(sanitizeTourName("  Fall Tour  ")).toBe("fall-tour")
  })

  it("collapses consecutive separators into one hyphen", () => {
    expect(sanitizeTourName("NYE Run -- 2025")).toBe("nye-run-2025")
  })
})

describe("getPlacementSuffix", () => {
  it.each([
    [1, "champion"],
    [2, "runner-up"],
    [3, "third-place"],
  ] as const)("placement %d -> %s", (placement, suffix) => {
    expect(getPlacementSuffix(placement)).toBe(suffix)
  })
})

describe("awardPickAchievement", () => {
  it("awards PERFECT_OPENER for an opener pick the user doesn't have yet", async () => {
    db.achievement.upsert.mockResolvedValue({ id: "ach-1" })
    db.userAchievement.findUnique.mockResolvedValue(null)

    const result = await awardPickAchievement("user-1", "OPENER", {
      songName: "Tweezer",
    })

    expect(result).toEqual({ awarded: true })
    expect(db.achievement.upsert.mock.calls[0][0].where).toEqual({
      slug: "perfect-opener",
    })
    expect(db.userAchievement.create).toHaveBeenCalledWith({
      data: {
        userId: "user-1",
        achievementId: "ach-1",
        metadata: { songName: "Tweezer" },
      },
    })
  })

  it("uses PERFECT_CLOSER for encore picks and defaults metadata to {}", async () => {
    db.achievement.upsert.mockResolvedValue({ id: "ach-2" })
    db.userAchievement.findUnique.mockResolvedValue(null)

    await awardPickAchievement("user-1", "ENCORE")

    expect(db.achievement.upsert.mock.calls[0][0].where).toEqual({
      slug: "perfect-closer",
    })
    expect(db.userAchievement.create.mock.calls[0][0].data.metadata).toEqual({})
  })

  it("is idempotent when the user already has it", async () => {
    db.achievement.upsert.mockResolvedValue({ id: "ach-1" })
    db.userAchievement.findUnique.mockResolvedValue({ id: "ua-1" })

    expect(await awardPickAchievement("user-1", "OPENER")).toEqual({
      awarded: false,
    })
    expect(db.userAchievement.create).not.toHaveBeenCalled()
  })

  it("returns the error message instead of throwing", async () => {
    db.achievement.upsert.mockRejectedValue(new Error("db down"))
    expect(await awardPickAchievement("user-1", "OPENER")).toEqual({
      awarded: false,
      error: "db down",
    })
  })

  it("stringifies non-Error throws", async () => {
    db.achievement.upsert.mockRejectedValue("boom")
    expect(await awardPickAchievement("user-1", "OPENER")).toEqual({
      awarded: false,
      error: "boom",
    })
  })
})

describe("awardSongPickAchievement", () => {
  it("awards the given slug with metadata", async () => {
    db.achievement.upsert.mockResolvedValue({ id: "ach-j" })
    db.userAchievement.findUnique.mockResolvedValue(null)

    expect(
      await awardSongPickAchievement("user-1", "JACKPOT", {
        songName: "Harpua",
      })
    ).toEqual({ awarded: true })
    expect(db.achievement.upsert.mock.calls[0][0].where).toEqual({
      slug: "jackpot",
    })
    expect(db.userAchievement.create.mock.calls[0][0].data.metadata).toEqual({
      songName: "Harpua",
    })
  })

  it("defaults metadata to {}", async () => {
    db.achievement.upsert.mockResolvedValue({ id: "ach-j" })
    db.userAchievement.findUnique.mockResolvedValue(null)
    await awardSongPickAchievement("user-1", "JACKPOT")
    expect(db.userAchievement.create.mock.calls[0][0].data.metadata).toEqual({})
  })

  it("skips users who already have it", async () => {
    db.achievement.upsert.mockResolvedValue({ id: "ach-j" })
    db.userAchievement.findUnique.mockResolvedValue({ id: "ua" })
    expect(await awardSongPickAchievement("user-1", "JACKPOT")).toEqual({
      awarded: false,
    })
  })

  it("returns errors instead of throwing", async () => {
    db.achievement.upsert.mockRejectedValue(new Error("nope"))
    expect(await awardSongPickAchievement("user-1", "JACKPOT")).toEqual({
      awarded: false,
      error: "nope",
    })
    db.achievement.upsert.mockRejectedValue(42)
    expect(await awardSongPickAchievement("user-1", "JACKPOT")).toEqual({
      awarded: false,
      error: "42",
    })
  })
})

describe("awardTourPlacementAchievement", () => {
  it.each([
    [1, "summer-tour-2025-champion", "Summer Tour 2025 Champion", "🥇"],
    [2, "summer-tour-2025-runner-up", "Summer Tour 2025 Runner-Up", "🥈"],
    [3, "summer-tour-2025-third-place", "Summer Tour 2025 Third Place", "🥉"],
  ] as const)(
    "placement %d upserts slug %s",
    async (placement, slug, name, icon) => {
      db.achievement.upsert.mockResolvedValue({ id: "ach-t" })
      db.userAchievement.findUnique.mockResolvedValue(null)

      const result = await awardTourPlacementAchievement(
        "user-1",
        "tour-1",
        "Summer Tour 2025",
        placement,
        { totalPoints: 40 }
      )

      expect(result).toEqual({ awarded: true })
      const args = db.achievement.upsert.mock.calls[0][0]
      expect(args.where).toEqual({ slug })
      expect(args.create).toMatchObject({
        name,
        icon,
        category: "RANKING",
        metadata: { tourId: "tour-1", tourName: "Summer Tour 2025", placement },
      })
      expect(db.userAchievement.create.mock.calls[0][0].data.metadata).toEqual({
        totalPoints: 40,
      })
    }
  )

  it("defaults metadata to {} and skips existing awards", async () => {
    db.achievement.upsert.mockResolvedValue({ id: "ach-t" })
    db.userAchievement.findUnique.mockResolvedValueOnce(null)
    await awardTourPlacementAchievement("u", "t", "Fall", 1)
    expect(db.userAchievement.create.mock.calls[0][0].data.metadata).toEqual({})

    db.userAchievement.findUnique.mockResolvedValueOnce({ id: "ua" })
    expect(await awardTourPlacementAchievement("u", "t", "Fall", 1)).toEqual({
      awarded: false,
    })
  })

  it("returns errors instead of throwing", async () => {
    db.achievement.upsert.mockRejectedValue(new Error("bad"))
    expect(await awardTourPlacementAchievement("u", "t", "Fall", 2)).toEqual({
      awarded: false,
      error: "bad",
    })
    db.achievement.upsert.mockRejectedValue("str")
    expect(await awardTourPlacementAchievement("u", "t", "Fall", 2)).toEqual({
      awarded: false,
      error: "str",
    })
  })
})

describe("processPickAchievements", () => {
  const submission = {
    userId: "user-1",
    show: { showDate: new Date("2025-07-04"), venue: "MSG" },
    picks: [
      { id: "p-open", pickType: "OPENER" as const, song: { name: "Tweezer" } },
      { id: "p-enc", pickType: "ENCORE" as const, song: { name: "Harpua" } },
      { id: "p-reg", pickType: "REGULAR" as const, song: { name: "Fee" } },
      { id: "p-harp", pickType: "REGULAR" as const, song: { name: "harpua!" } },
    ],
  }

  beforeEach(() => {
    db.achievement.upsert.mockImplementation(
      async (args: { where: { slug: string } }) => ({ id: args.where.slug })
    )
    db.userAchievement.findUnique.mockResolvedValue(null)
  })

  it("awards opener/closer and JACKPOT only for picks that just became correct", async () => {
    const result = await processPickAchievements(
      [
        { id: "p-open", wasPlayed: true, previousWasPlayed: null },
        // Encore + Harpua: earns both PERFECT_CLOSER and JACKPOT
        { id: "p-enc", wasPlayed: true, previousWasPlayed: false },
        // Regular non-Harpua: no achievement
        { id: "p-reg", wasPlayed: true },
        // Already correct last run: skipped
        { id: "p-harp", wasPlayed: true, previousWasPlayed: true },
        // Not played: skipped
        { id: "missing", wasPlayed: false },
      ],
      submission
    )

    expect(result).toEqual({ awarded: 3, errors: 0 })
    const slugs = db.achievement.upsert.mock.calls.map(
      (c) => (c[0] as { where: { slug: string } }).where.slug
    )
    expect(slugs).toEqual(["perfect-opener", "perfect-closer", "jackpot"])
  })

  it("ignores scored picks that aren't in the submission", async () => {
    expect(
      await processPickAchievements(
        [{ id: "unknown", wasPlayed: true }],
        submission
      )
    ).toEqual({ awarded: 0, errors: 0 })
  })

  it("counts errors and treats already-owned achievements as non-errors", async () => {
    db.userAchievement.findUnique.mockResolvedValueOnce({ id: "owned" })
    db.achievement.upsert
      .mockImplementationOnce(async () => ({ id: "x" }))
      .mockRejectedValueOnce(new Error("closer fail"))
      .mockRejectedValueOnce(new Error("jackpot fail"))

    const result = await processPickAchievements(
      [
        { id: "p-open", wasPlayed: true },
        { id: "p-enc", wasPlayed: true },
      ],
      submission
    )

    expect(result).toEqual({ awarded: 0, errors: 2 })
  })

  it("does not count a JACKPOT the user already owns", async () => {
    db.userAchievement.findUnique.mockResolvedValue({ id: "owned" })
    expect(
      await processPickAchievements(
        [{ id: "p-harp", wasPlayed: true }],
        submission
      )
    ).toEqual({ awarded: 0, errors: 0 })
  })
})
