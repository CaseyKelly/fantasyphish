export interface DraftPick {
  songId: string
  songName: string
  pickType: "OPENER" | "ENCORE" | "REGULAR"
}

export interface PickDraft {
  openerPick: DraftPick | null
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
  validSongIds: Set<string>
): PickDraft | null {
  if (typeof window === "undefined") return null
  try {
    const raw = window.localStorage.getItem(getDraftKey(userId, showId))
    if (!raw) return null
    const parsed = JSON.parse(raw)
    if (!parsed || typeof parsed !== "object") return null

    const openerPick =
      isDraftPick(parsed.openerPick) &&
      validSongIds.has(parsed.openerPick.songId)
        ? parsed.openerPick
        : null
    const encorePick =
      isDraftPick(parsed.encorePick) &&
      validSongIds.has(parsed.encorePick.songId)
        ? parsed.encorePick
        : null
    const regularPicks: DraftPick[] = Array.isArray(parsed.regularPicks)
      ? parsed.regularPicks.filter(
          (p: unknown): p is DraftPick =>
            isDraftPick(p) && validSongIds.has(p.songId)
        )
      : []

    if (!openerPick && !encorePick && regularPicks.length === 0) return null
    return { openerPick, encorePick, regularPicks }
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
      !draft.openerPick &&
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
