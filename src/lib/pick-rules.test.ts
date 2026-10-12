import { describe, it, expect } from "vitest"
import {
  getMaxPoints,
  getOpenerLabel,
  getOpenerSets,
  getRegularPickCount,
  isValidSetCount,
  validatePicks,
  type PickInput,
} from "./pick-rules"

function buildPicks(setCount: number): PickInput[] {
  const picks: PickInput[] = getOpenerSets(setCount).map((set) => ({
    songId: `opener-${set}`,
    pickType: "OPENER",
    openerSet: set,
  }))
  picks.push({ songId: "encore", pickType: "ENCORE" })
  for (let i = 0; i < getRegularPickCount(setCount); i++) {
    picks.push({ songId: `regular-${i}`, pickType: "REGULAR" })
  }
  return picks
}

describe("pick counts by set count", () => {
  it.each([
    [1, 11, 17],
    [2, 10, 19],
    [3, 9, 21],
  ])(
    "%i set(s) -> %i regular picks, %i max points",
    (setCount, regular, max) => {
      expect(getRegularPickCount(setCount)).toBe(regular)
      expect(getMaxPoints(setCount)).toBe(max)
      expect(buildPicks(setCount)).toHaveLength(13)
    }
  )
})

describe("isValidSetCount", () => {
  it("accepts 1 through 3 only", () => {
    expect([0, 1, 2, 3, 4, 1.5].map(isValidSetCount)).toEqual([
      false,
      true,
      true,
      true,
      false,
      false,
    ])
  })
})

describe("getOpenerLabel", () => {
  it("says just Opener on a one-set show", () => {
    expect(getOpenerLabel(1, 1)).toBe("Opener")
  })

  it("names the set on multi-set shows, defaulting legacy picks to set 1", () => {
    expect(getOpenerLabel(2, 2)).toBe("Set 2 Opener")
    expect(getOpenerLabel(null, 3)).toBe("Set 1 Opener")
  })
})

describe("validatePicks", () => {
  it.each([1, 2, 3])("accepts a complete %i-set submission", (setCount) => {
    expect(validatePicks(buildPicks(setCount), setCount)).toBeNull()
  })

  it("rejects a one-opener submission for a two-set show", () => {
    expect(validatePicks(buildPicks(1), 2)).toBe(
      "You must select exactly 2 openers (one per set)"
    )
  })

  it("rejects two openers for the same set", () => {
    const picks = buildPicks(2)
    picks[1] = { ...picks[1], openerSet: 1 }
    expect(validatePicks(picks, 2)).toBe(
      "Each set needs exactly one opener pick"
    )
  })

  it("rejects an opener for a set the show doesn't have", () => {
    const picks = buildPicks(2)
    picks[1] = { ...picks[1], openerSet: 3 }
    expect(validatePicks(picks, 2)).toBe(
      "Each set needs exactly one opener pick"
    )
  })

  it("rejects the wrong number of regular picks", () => {
    const picks = buildPicks(2)
    picks.push({ songId: "extra", pickType: "REGULAR" })
    expect(validatePicks(picks, 2)).toBe(
      "You must select exactly 10 regular songs"
    )
  })

  it("rejects a set number on a non-opener pick", () => {
    const picks = buildPicks(1)
    picks[1] = { ...picks[1], openerSet: 1 }
    expect(validatePicks(picks, 1)).toBe(
      "Only opener picks can have a set number"
    )
  })

  it("rejects duplicate songs", () => {
    const picks = buildPicks(1)
    picks[2] = { ...picks[2], songId: picks[0].songId }
    expect(validatePicks(picks, 1)).toBe("You cannot pick the same song twice")
  })
})
