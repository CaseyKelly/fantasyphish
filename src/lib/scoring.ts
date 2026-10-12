import { PickType } from "@prisma/client"
import {
  parseSetlist,
  normalizeSongName,
  type ParsedSetlist,
  type PhishNetSetlist,
} from "./phishnet"
import { POINTS, getOpenerSet } from "./pick-rules"

export { POINTS }

interface PickToScore {
  id: string
  pickType: PickType
  openerSet?: number | null
  song: {
    name: string
    slug: string
  }
}

interface ScoredPick {
  id: string
  wasPlayed: boolean | null
  pointsEarned: number
}

/**
 * A set's opener is settled once it has a first song. If it never gets
 * one, it's settled as a miss once the show has moved past it (a later set
 * or the encore started) or the show is final - e.g. a show that ends
 * after set 1 because of weather.
 */
function hasShowMovedPastSet(
  parsed: ParsedSetlist,
  setNumber: number
): boolean {
  if (parsed.encoreSongs.length > 0) return true
  return Object.keys(parsed.setOpeners).some((set) => Number(set) > setNumber)
}

export function scoreSubmission(
  picks: PickToScore[],
  setlist: PhishNetSetlist,
  options: { isFinal?: boolean } = {}
): { scoredPicks: ScoredPick[]; totalPoints: number } {
  const parsed = parseSetlist(setlist)
  const scoredPicks: ScoredPick[] = []
  let totalPoints = 0

  for (const pick of picks) {
    const normalizedPickName = normalizeSongName(pick.song.name)
    let wasPlayed: boolean | null = null
    let pointsEarned = 0

    if (pick.pickType === "OPENER") {
      // Opener must match the first song of the set it was picked for
      const setNumber = getOpenerSet(pick)
      const setOpener = parsed.setOpeners[setNumber]
      if (setOpener) {
        wasPlayed = normalizeSongName(setOpener) === normalizedPickName
        pointsEarned = wasPlayed ? POINTS.OPENER : 0
      } else if (options.isFinal || hasShowMovedPastSet(parsed, setNumber)) {
        wasPlayed = false
      }
      // Otherwise the set hasn't started yet, so wasPlayed stays null
    } else if (pick.pickType === "ENCORE") {
      // Encore must be in the encore set
      if (parsed.encoreSongs.length > 0) {
        wasPlayed = parsed.encoreSongs.some(
          (song) => normalizeSongName(song) === normalizedPickName
        )
        pointsEarned = wasPlayed ? POINTS.ENCORE : 0
      } else if (options.isFinal) {
        wasPlayed = false
      }
      // If no encore yet, wasPlayed stays null
    } else {
      // Regular pick - just needs to be played anywhere
      wasPlayed = parsed.allSongs.some(
        (song) => normalizeSongName(song) === normalizedPickName
      )
      pointsEarned = wasPlayed ? POINTS.REGULAR : 0
    }

    totalPoints += pointsEarned
    scoredPicks.push({
      id: pick.id,
      wasPlayed,
      pointsEarned,
    })
  }

  return { scoredPicks, totalPoints }
}

export function getPickTypeLabel(pickType: PickType): string {
  switch (pickType) {
    case "OPENER":
      return "Opener"
    case "ENCORE":
      return "Encore"
    case "REGULAR":
      return "Regular"
    default:
      return "Unknown"
  }
}

export function getPickTypePoints(pickType: PickType): number {
  switch (pickType) {
    case "OPENER":
      return POINTS.OPENER
    case "ENCORE":
      return POINTS.ENCORE
    case "REGULAR":
      return POINTS.REGULAR
    default:
      return 0
  }
}

/**
 * Score submission progressively (handles incomplete setlists)
 * Returns score and whether the show is complete
 */
export function scoreSubmissionProgressive(
  picks: PickToScore[],
  setlist: PhishNetSetlist,
  previousSongCount: number = 0,
  options: { isFinal?: boolean } = {}
): {
  scoredPicks: ScoredPick[]
  totalPoints: number
  isComplete: boolean
  currentSongCount: number
  hasNewSongs: boolean
} {
  const parsed = parseSetlist(setlist)
  const currentSongCount = parsed.allSongs.length
  const hasNewSongs = currentSongCount > previousSongCount
  const isComplete = setlist.songs.some(
    (song) => song.set.toLowerCase() === "e"
  )

  // Use existing scoring logic
  const { scoredPicks, totalPoints } = scoreSubmission(picks, setlist, options)

  return {
    scoredPicks,
    totalPoints,
    isComplete,
    currentSongCount,
    hasNewSongs,
  }
}
