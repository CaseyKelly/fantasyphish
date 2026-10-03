import { describe, it, expect } from "vitest"
import { AchievementCategory } from "@prisma/client"
import {
  ACHIEVEMENT_DEFINITIONS,
  STREAK_ACHIEVEMENTS,
  earnedStreakAchievements,
} from "./achievements"

describe("ACHIEVEMENT_DEFINITIONS", () => {
  it("has a unique slug per definition", () => {
    const slugs = Object.values(ACHIEVEMENT_DEFINITIONS).map((d) => d.slug)
    expect(new Set(slugs).size).toBe(slugs.length)
  })

  it("uses a valid AchievementCategory for every definition", () => {
    const validCategories = new Set(Object.values(AchievementCategory))
    for (const def of Object.values(ACHIEVEMENT_DEFINITIONS)) {
      expect(validCategories.has(def.category)).toBe(true)
    }
  })

  it("matches the expected set of keys (fails loudly on drift)", () => {
    expect(Object.keys(ACHIEVEMENT_DEFINITIONS).sort()).toEqual(
      [
        "FOUNDING_MEMBER",
        "PERFECT_OPENER",
        "PERFECT_CLOSER",
        "JACKPOT",
        "DONUT_DEVOTEE",
        "NYE_RUN_2025_PARTICIPANT",
        "ICCULUS",
        "STREAK_5",
        "STREAK_10",
        "STREAK_25",
        "STREAK_50",
      ].sort()
    )
  })
})

describe("STREAK_ACHIEVEMENTS", () => {
  it("is ordered by ascending streak length", () => {
    const lengths = STREAK_ACHIEVEMENTS.map(
      (key) => ACHIEVEMENT_DEFINITIONS[key].metadata.streakLength
    )
    expect(lengths).toEqual([...lengths].sort((a, b) => a - b))
  })
})

describe("earnedStreakAchievements", () => {
  it("earns nothing below the first milestone", () => {
    expect(earnedStreakAchievements(0)).toEqual([])
    expect(earnedStreakAchievements(4)).toEqual([])
  })

  it("earns a milestone exactly at its length", () => {
    expect(earnedStreakAchievements(5)).toEqual(["STREAK_5"])
  })

  it("earns every milestone at or below the best streak", () => {
    expect(earnedStreakAchievements(27)).toEqual([
      "STREAK_5",
      "STREAK_10",
      "STREAK_25",
    ])
    expect(earnedStreakAchievements(80)).toEqual([...STREAK_ACHIEVEMENTS])
  })
})
