import { PickType } from "@prisma/client"
import {
  parseSetlist,
  normalizeSongName,
  type PhishNetSetlist,
} from "./phishnet"

interface PickToScore {
  id: string
  pickType: PickType
  song: {
    name: string
    slug: string
  }
}

interface ScoredPick {
  id: string
  wasPlayed: boolean
  pointsEarned: number
}

export const POINTS = {
  OPENER: 3,
  ENCORE: 3,
  REGULAR: 1,
} as const

export const MAX_POINTS = POINTS.OPENER + POINTS.ENCORE + 11 * POINTS.REGULAR // 17 total

export function scoreSubmission(
  picks: PickToScore[],
  setlist: PhishNetSetlist
): { scoredPicks: ScoredPick[]; totalPoints: number } {
  const parsed = parseSetlist(setlist)
  const scoredPicks: ScoredPick[] = []
  let totalPoints = 0

  for (const pick of picks) {
    const normalizedPickName = normalizeSongName(pick.song.name)
    let wasPlayed = false
    let pointsEarned = 0

    if (pick.pickType === "OPENER") {
      // Opener must match first song of set 1
      if (parsed.opener) {
        wasPlayed = normalizeSongName(parsed.opener) === normalizedPickName
      }
      pointsEarned = wasPlayed ? POINTS.OPENER : 0
    } else if (pick.pickType === "ENCORE") {
      // Encore must be in the encore set
      wasPlayed = parsed.encoreSongs.some(
        (song) => normalizeSongName(song) === normalizedPickName
      )
      pointsEarned = wasPlayed ? POINTS.ENCORE : 0
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
  previousSongCount: number = 0
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
  const { scoredPicks, totalPoints } = scoreSubmission(picks, setlist)

  return {
    scoredPicks,
    totalPoints,
    isComplete,
    currentSongCount,
    hasNewSongs,
  }
}
