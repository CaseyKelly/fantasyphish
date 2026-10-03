import type { PickType } from "@prisma/client"

export interface ProfileStatsPick {
  pickType: PickType
  wasPlayed: boolean | null
  song: { id: string; name: string }
}

export interface ProfileStatsSubmission {
  picks: ProfileStatsPick[]
}

export interface PickTypeStat {
  hits: number
  attempts: number
  // Whole-number percentage, 0 when there are no attempts
  rate: number
}

export interface SongCount {
  name: string
  count: number
}

export interface PickBreakdown {
  opener: PickTypeStat
  encore: PickTypeStat
  regular: PickTypeStat
  // Shows where both the opener and at least one encore pick hit
  bookendShows: number
  // Most hits in a single show (all pick types)
  mostHitsInShow: number
  uniqueSongsPicked: number
  // Most-picked song across all shows; ties go to the song with more hits,
  // then alphabetically
  favoriteSong: SongCount | null
  // Song that has hit the most times; ties go alphabetically
  mostReliableSong: SongCount | null
}

function toStat(hits: number, attempts: number): PickTypeStat {
  return {
    hits,
    attempts,
    rate: attempts > 0 ? Math.round((hits / attempts) * 100) : 0,
  }
}

export function computePickBreakdown(
  submissions: ProfileStatsSubmission[]
): PickBreakdown {
  const totals: Record<PickType, { hits: number; attempts: number }> = {
    OPENER: { hits: 0, attempts: 0 },
    ENCORE: { hits: 0, attempts: 0 },
    REGULAR: { hits: 0, attempts: 0 },
  }
  const songs = new Map<string, { name: string; picks: number; hits: number }>()
  let bookendShows = 0
  let mostHitsInShow = 0

  for (const submission of submissions) {
    let openerHit = false
    let encoreHit = false
    let showHits = 0

    for (const pick of submission.picks) {
      const hit = pick.wasPlayed === true
      totals[pick.pickType].attempts++
      if (hit) {
        totals[pick.pickType].hits++
        showHits++
        if (pick.pickType === "OPENER") openerHit = true
        if (pick.pickType === "ENCORE") encoreHit = true
      }

      const song = songs.get(pick.song.id) ?? {
        name: pick.song.name,
        picks: 0,
        hits: 0,
      }
      song.picks++
      if (hit) song.hits++
      songs.set(pick.song.id, song)
    }

    if (openerHit && encoreHit) bookendShows++
    mostHitsInShow = Math.max(mostHitsInShow, showHits)
  }

  const songList = [...songs.values()]
  const favorite = [...songList].sort(
    (a, b) =>
      b.picks - a.picks || b.hits - a.hits || a.name.localeCompare(b.name)
  )[0]
  const reliable = songList
    .filter((s) => s.hits > 0)
    .sort((a, b) => b.hits - a.hits || a.name.localeCompare(b.name))[0]

  return {
    opener: toStat(totals.OPENER.hits, totals.OPENER.attempts),
    encore: toStat(totals.ENCORE.hits, totals.ENCORE.attempts),
    regular: toStat(totals.REGULAR.hits, totals.REGULAR.attempts),
    bookendShows,
    mostHitsInShow,
    uniqueSongsPicked: songs.size,
    favoriteSong: favorite
      ? { name: favorite.name, count: favorite.picks }
      : null,
    mostReliableSong: reliable
      ? { name: reliable.name, count: reliable.hits }
      : null,
  }
}
