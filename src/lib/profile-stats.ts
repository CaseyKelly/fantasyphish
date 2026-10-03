import type { PickType } from "@prisma/client"

export interface PickTypeRecord {
  hits: number
  scored: number
}

export type PickTypeStats = Record<PickType, PickTypeRecord>

export interface ShowStreaks {
  current: number
  longest: number
}

/**
 * Tally hits per pick type. Only picks that have been scored
 * (wasPlayed !== null) count toward `scored`, so a show in progress doesn't
 * drag the hit rate down before its songs have been played.
 */
export function computePickTypeStats(
  picks: { pickType: PickType; wasPlayed: boolean | null }[]
): PickTypeStats {
  const stats: PickTypeStats = {
    OPENER: { hits: 0, scored: 0 },
    ENCORE: { hits: 0, scored: 0 },
    REGULAR: { hits: 0, scored: 0 },
  }

  for (const pick of picks) {
    if (pick.wasPlayed === null) continue
    stats[pick.pickType].scored++
    if (pick.wasPlayed) stats[pick.pickType].hits++
  }

  return stats
}

/**
 * Compute consecutive-show participation streaks.
 *
 * @param lockedShowIds - IDs of every show that has locked, oldest first
 * @param playedShowIds - IDs of shows the user submitted picks for
 * @returns `current` counts back from the most recent locked show (0 if the
 *   user missed it); `longest` is the best run anywhere in the history
 */
export function computeShowStreaks(
  lockedShowIds: string[],
  playedShowIds: Set<string>
): ShowStreaks {
  let longest = 0
  let run = 0

  for (const showId of lockedShowIds) {
    run = playedShowIds.has(showId) ? run + 1 : 0
    longest = Math.max(longest, run)
  }

  // After the loop, `run` is the streak ending at the most recent show
  return { current: run, longest }
}
