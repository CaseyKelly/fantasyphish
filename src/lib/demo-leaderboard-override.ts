// DEMO ONLY — branch preview/leaderboard-demo-donotmerge. Never merge to main.
// Re-shapes the "This Show" leaderboard in memory (no database writes) so that
// Funky20 sits two points ahead of the real current leaders and PiperMaMa takes
// second. Disabled on production deployments via VERCEL_ENV.
import type { LeaderboardEntry, LeaderboardPick } from "@/lib/leaderboard"

const FIRST_PLACE_USER = "funky20"
const SECOND_PLACE_USER = "pipermama"

const ENCORE_HIT = "Gotta Jibboo" // 3 pts
const REGULAR_HITS = ["Wolfman's Brother", "Lonely Trip"] // 1 pt each

export function isDemoOverrideEnabled(): boolean {
  return process.env.VERCEL_ENV !== "production"
}

function recomputeStats(entry: LeaderboardEntry): LeaderboardEntry {
  const totalPoints = entry.picksByShow.reduce(
    (sum, s) => sum + s.totalPoints,
    0
  )
  const totalPicks = entry.picksByShow.length * 13
  const correctPicks = entry.picksByShow.reduce(
    (sum, s) => sum + s.picks.filter((p) => p.wasPlayed).length,
    0
  )
  return {
    ...entry,
    totalPoints,
    avgPoints:
      entry.picksByShow.length > 0
        ? Math.round((totalPoints / entry.picksByShow.length) * 10) / 10
        : 0,
    accuracy:
      totalPicks > 0 ? Math.round((correctPicks / totalPicks) * 100) : 0,
  }
}

function rerank(entries: LeaderboardEntry[]): LeaderboardEntry[] {
  const sorted = [...entries].sort((a, b) => b.totalPoints - a.totalPoints)
  let currentRank = 1
  return sorted.map((entry, index) => {
    if (index > 0 && entry.totalPoints !== sorted[index - 1].totalPoints) {
      currentRank = index + 1
    }
    return { ...entry, rank: currentRank }
  })
}

function rebuildFunkyPicks(
  picks: LeaderboardPick[],
  targetPoints: number
): LeaderboardPick[] {
  const miss = (p: LeaderboardPick): LeaderboardPick => ({
    ...p,
    wasPlayed: false,
    pointsEarned: 0,
  })

  const opener = picks.find((p) => p.pickType === "OPENER")
  const existingRegularNames = picks
    .filter((p) => p.pickType === "REGULAR")
    .map((p) => p.songName)
    .filter((name) => !REGULAR_HITS.includes(name) && name !== ENCORE_HIT)

  // Encore hit (3 pts) + as many regular hits (1 pt each) as needed to land
  // exactly on targetPoints. The named hits come first, then real pick names.
  const regularHitsNeeded = Math.min(Math.max(targetPoints - 3, 0), 11)
  const regularNames = [...REGULAR_HITS, ...existingRegularNames].slice(0, 11)
  const regulars: LeaderboardPick[] = regularNames.map((songName, i) => ({
    songName,
    pickType: "REGULAR",
    wasPlayed: i < regularHitsNeeded,
    pointsEarned: i < regularHitsNeeded ? 1 : 0,
  }))
  while (regulars.length < 11) {
    regulars.push({
      songName: "Sample in a Jar",
      pickType: "REGULAR",
      wasPlayed: false,
      pointsEarned: 0,
    })
  }

  return [
    opener
      ? miss(opener)
      : {
          songName: "Free",
          pickType: "OPENER",
          wasPlayed: false,
          pointsEarned: 0,
        },
    ...regulars,
    {
      songName: ENCORE_HIT,
      pickType: "ENCORE",
      wasPlayed: true,
      pointsEarned: 3,
    },
  ]
}

export function applyShowDemoOverride(
  entries: LeaderboardEntry[]
): LeaderboardEntry[] {
  const funky = entries.find(
    (e) => e.username.toLowerCase() === FIRST_PLACE_USER
  )
  const piper = entries.find(
    (e) => e.username.toLowerCase() === SECOND_PLACE_USER
  )
  if (!funky || !piper || funky.picksByShow.length === 0) return entries

  const fieldBest = Math.max(
    0,
    ...entries
      .filter((e) => e !== funky && e !== piper)
      .map((e) => e.totalPoints)
  )
  const funkyTarget = fieldBest + 2
  const piperTarget = fieldBest + 1

  const overridden = entries.map((entry) => {
    if (entry === funky) {
      const show = entry.picksByShow[0]
      const picks = rebuildFunkyPicks(show.picks, funkyTarget)
      return recomputeStats({
        ...entry,
        picksByShow: [
          {
            ...show,
            totalPoints: picks.reduce((s, p) => s + p.pointsEarned, 0),
            picks,
          },
        ],
      })
    }
    if (entry === piper && entry.totalPoints < piperTarget) {
      let needed = piperTarget - entry.totalPoints
      const picksByShow = entry.picksByShow.map((show) => {
        const picks = show.picks.map((p) => {
          if (needed > 0 && !p.wasPlayed && p.pickType === "REGULAR") {
            needed -= 1
            return { ...p, wasPlayed: true, pointsEarned: 1 }
          }
          return p
        })
        return {
          ...show,
          totalPoints: picks.reduce((s, p) => s + p.pointsEarned, 0),
          picks,
        }
      })
      return recomputeStats({ ...entry, picksByShow })
    }
    return entry
  })

  return rerank(overridden)
}
