// Pick composition rules that depend on how many sets a show has.
// Shared by the picker UI and the server-side submission validation, so
// keep this file free of server-only imports.

export const TOTAL_PICKS = 13
export const MIN_SET_COUNT = 1
export const MAX_SET_COUNT = 3
export const DEFAULT_SET_COUNT = 2

export const POINTS = {
  OPENER: 3,
  ENCORE: 3,
  REGULAR: 1,
} as const

export type PickTypeName = "OPENER" | "ENCORE" | "REGULAR"

export interface PickInput {
  songId: string
  pickType: PickTypeName
  openerSet?: number | null
}

export function isValidSetCount(setCount: number): boolean {
  return (
    Number.isInteger(setCount) &&
    setCount >= MIN_SET_COUNT &&
    setCount <= MAX_SET_COUNT
  )
}

/** One opener per set, one encore, and regular picks fill the rest of 13. */
export function getRegularPickCount(setCount: number): number {
  return TOTAL_PICKS - setCount - 1
}

/** 1 set → 17, 2 sets → 19, 3 sets → 21 */
export function getMaxPoints(setCount: number): number {
  return (
    setCount * POINTS.OPENER +
    POINTS.ENCORE +
    getRegularPickCount(setCount) * POINTS.REGULAR
  )
}

/** Set numbers (1-based) that need an opener pick for a show. */
export function getOpenerSets(setCount: number): number[] {
  return Array.from({ length: setCount }, (_, i) => i + 1)
}

/**
 * Display label for an opener pick. A one-set show (and every pick made
 * before set openers existed) just says "Opener".
 */
export function getOpenerLabel(
  openerSet: number | null | undefined,
  setCount: number
): string {
  if (setCount <= 1) return "Opener"
  return `Set ${openerSet ?? 1} Opener`
}

/** Opener picks predate `openerSet`; treat a missing value as set 1. */
export function getOpenerSet(pick: { openerSet?: number | null }): number {
  return pick.openerSet ?? 1
}

/**
 * Checks a full pick submission against a show's set count. Returns an
 * error message, or null if the picks are valid.
 */
export function validatePicks(
  picks: PickInput[],
  setCount: number
): string | null {
  const openerPicks = picks.filter((p) => p.pickType === "OPENER")
  const encorePicks = picks.filter((p) => p.pickType === "ENCORE")
  const regularPicks = picks.filter((p) => p.pickType === "REGULAR")
  const regularCount = getRegularPickCount(setCount)

  if (openerPicks.length !== setCount) {
    return setCount === 1
      ? "You must select exactly 1 opener"
      : `You must select exactly ${setCount} openers (one per set)`
  }

  const expectedSets = getOpenerSets(setCount)
  const pickedSets = openerPicks
    .map((p) => p.openerSet ?? 1)
    .sort((a, b) => a - b)
  if (pickedSets.some((set, i) => set !== expectedSets[i])) {
    return "Each set needs exactly one opener pick"
  }

  if (encorePicks.length !== 1) {
    return "You must select exactly 1 encore"
  }

  if (regularPicks.length !== regularCount) {
    return `You must select exactly ${regularCount} regular songs`
  }

  if (picks.some((p) => p.pickType !== "OPENER" && p.openerSet != null)) {
    return "Only opener picks can have a set number"
  }

  const songIds = picks.map((p) => p.songId)
  if (new Set(songIds).size !== songIds.length) {
    return "You cannot pick the same song twice"
  }

  return null
}

export interface PickUpdateNeeded {
  // Sets that have no opener pick yet
  missingOpenerSets: number[]
  // Regular picks over the show's regular-pick limit
  extraRegularPicks: number
}

/**
 * What a saved submission still needs after an admin raised the show's set
 * count, or null if it already matches the show. Saved picks keep scoring
 * as they are in the meantime - this only drives the "update your picks"
 * prompts.
 */
export function getPickUpdateNeeded(
  picks: Pick<PickInput, "pickType" | "openerSet">[],
  setCount: number
): PickUpdateNeeded | null {
  const pickedSets = new Set(
    picks.filter((p) => p.pickType === "OPENER").map((p) => p.openerSet ?? 1)
  )
  const missingOpenerSets = getOpenerSets(setCount).filter(
    (set) => !pickedSets.has(set)
  )
  const regularCount = picks.filter((p) => p.pickType === "REGULAR").length
  const extraRegularPicks = Math.max(
    0,
    regularCount - getRegularPickCount(setCount)
  )
  if (missingOpenerSets.length === 0 && extraRegularPicks === 0) return null
  return { missingOpenerSets, extraRegularPicks }
}

/** e.g. "Choose a Set 2 opener and remove 1 regular pick" */
export function describePickUpdateNeeded(needed: PickUpdateNeeded): string {
  const parts: string[] = []
  if (needed.missingOpenerSets.length > 0) {
    const sets = needed.missingOpenerSets.map((set) => `Set ${set}`)
    parts.push(
      sets.length === 1
        ? `choose a ${sets[0]} opener`
        : `choose ${sets.join(" and ")} openers`
    )
  }
  if (needed.extraRegularPicks > 0) {
    parts.push(
      `remove ${needed.extraRegularPicks} regular pick${
        needed.extraRegularPicks === 1 ? "" : "s"
      }`
    )
  }
  const text = parts.join(" and ")
  return text.charAt(0).toUpperCase() + text.slice(1)
}
