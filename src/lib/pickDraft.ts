import { getOpenerSets, getRegularPickCount } from "@/lib/pick-rules"

export interface DraftPick {
  songId: string
  songName: string
  pickType: "OPENER" | "ENCORE" | "REGULAR"
  openerSet?: number | null
}

export interface PickDraft {
  // One slot per set, index 0 = set 1
  openerPicks: (DraftPick | null)[]
  encorePick: DraftPick | null
  regularPicks: DraftPick[]
}

const DRAFT_KEY_PREFIX = "fp:draft-picks:v1"

function getDraftKey(userId: string, showId: string): string {
  return `${DRAFT_KEY_PREFIX}:${userId}:${showId}`
}

function isDraftPick(value: unknown): value is DraftPick {
  if (!value || typeof value !== "object") return false
  const v = value as Record<string, unknown>
  return (
    typeof v.songId === "string" &&
    typeof v.songName === "string" &&
    (v.pickType === "OPENER" ||
      v.pickType === "ENCORE" ||
      v.pickType === "REGULAR")
  )
}

export function readPickDraft(
  userId: string,
  showId: string,
  validSongIds: Set<string>,
  setCount: number
): PickDraft | null {
  if (typeof window === "undefined") return null
  try {
    const raw = window.localStorage.getItem(getDraftKey(userId, showId))
    if (!raw) return null
    const parsed = JSON.parse(raw)
    if (!parsed || typeof parsed !== "object") return null

    const isValid = (p: unknown): p is DraftPick =>
      isDraftPick(p) && validSongIds.has(p.songId)

    // Drafts saved before set openers existed have a single `openerPick`,
    // which was always the set 1 opener
    const storedOpeners: unknown[] = Array.isArray(parsed.openerPicks)
      ? parsed.openerPicks
      : [parsed.openerPick]
    const openerPicks = getOpenerSets(setCount).map((set) => {
      const stored = storedOpeners[set - 1]
      return isValid(stored) ? { ...stored, openerSet: set } : null
    })
    const encorePick = isValid(parsed.encorePick) ? parsed.encorePick : null
    // The show's set count can change before anyone submits, which can
    // shrink the number of regular slots - drop any overflow
    const regularPicks: DraftPick[] = Array.isArray(parsed.regularPicks)
      ? parsed.regularPicks
          .filter(isValid)
          .slice(0, getRegularPickCount(setCount))
      : []

    if (
      openerPicks.every((p) => p === null) &&
      !encorePick &&
      regularPicks.length === 0
    ) {
      return null
    }
    return { openerPicks, encorePick, regularPicks }
  } catch (err) {
    console.warn("Failed to read pick draft from localStorage", err)
    return null
  }
}

export function writePickDraft(
  userId: string,
  showId: string,
  draft: PickDraft
): void {
  if (typeof window === "undefined") return
  try {
    const key = getDraftKey(userId, showId)
    if (
      draft.openerPicks.every((p) => p === null) &&
      !draft.encorePick &&
      draft.regularPicks.length === 0
    ) {
      window.localStorage.removeItem(key)
      return
    }
    window.localStorage.setItem(key, JSON.stringify(draft))
  } catch (err) {
    console.warn("Failed to write pick draft to localStorage", err)
  }
}

export function clearPickDraft(userId: string, showId: string): void {
  if (typeof window === "undefined") return
  try {
    window.localStorage.removeItem(getDraftKey(userId, showId))
  } catch (err) {
    console.warn("Failed to clear pick draft from localStorage", err)
  }
}
