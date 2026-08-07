import { describe, it, expect } from "vitest"
import { AchievementCategory } from "@prisma/client"
import { ACHIEVEMENT_DEFINITIONS } from "./achievements"

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
      ].sort()
    )
  })
})
