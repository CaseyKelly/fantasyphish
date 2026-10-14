import { describe, it, expect } from "vitest"
import {
  describePickUpdateNeeded,
  isSlotHit,
  getMaxPoints,
  getOpenerLabel,
  getOpenerSets,
  getPickUpdateNeeded,
  getRegularPickCount,
  isValidSetCount,
  POINTS,
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

describe("getPickUpdateNeeded", () => {
  it("is null when the picks already match the show", () => {
    expect(getPickUpdateNeeded(buildPicks(2), 2)).toBeNull()
  })

  it("asks a one-set submission on a now two-set show for a Set 2 opener and one fewer regular", () => {
    expect(getPickUpdateNeeded(buildPicks(1), 2)).toEqual({
      missingOpenerSets: [2],
      extraRegularPicks: 1,
    })
  })

  it("treats legacy opener picks without a set number as Set 1", () => {
    const legacy = buildPicks(1).map((p) =>
      p.pickType === "OPENER" ? { ...p, openerSet: null } : p
    )
    expect(getPickUpdateNeeded(legacy, 3)).toEqual({
      missingOpenerSets: [2, 3],
      extraRegularPicks: 2,
    })
  })
})

describe("describePickUpdateNeeded", () => {
  it("reads naturally for one missing set", () => {
    expect(
      describePickUpdateNeeded({ missingOpenerSets: [2], extraRegularPicks: 1 })
    ).toBe("Choose a Set 2 opener and remove 1 regular pick")
  })

  it("reads naturally for two missing sets", () => {
    expect(
      describePickUpdateNeeded({
        missingOpenerSets: [2, 3],
        extraRegularPicks: 2,
      })
    ).toBe("Choose Set 2 and Set 3 openers and remove 2 regular picks")
  })
})

describe("isSlotHit", () => {
  it("is true only when an opener/encore pick earned its full points", () => {
    expect(isSlotHit({ pickType: "OPENER", pointsEarned: POINTS.OPENER })).toBe(
      true
    )
    expect(isSlotHit({ pickType: "ENCORE", pointsEarned: POINTS.ENCORE })).toBe(
      true
    )
    // Played elsewhere in the show - regular points only
    expect(
      isSlotHit({ pickType: "OPENER", pointsEarned: POINTS.REGULAR })
    ).toBe(false)
    expect(isSlotHit({ pickType: "ENCORE", pointsEarned: 0 })).toBe(false)
    expect(isSlotHit({ pickType: "OPENER", pointsEarned: null })).toBe(false)
  })

  it("is never true for regular picks", () => {
    expect(
      isSlotHit({ pickType: "REGULAR", pointsEarned: POINTS.REGULAR })
    ).toBe(false)
  })
})
