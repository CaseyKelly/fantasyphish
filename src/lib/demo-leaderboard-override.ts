// DEMO ONLY — branch preview/leaderboard-demo-donotmerge. Never merge to main.
// Re-shapes the "This Show" leaderboard in memory (no database writes) so that
// Funky20 sits two points ahead of the real current leaders and PiperMaMa takes
// second. Disabled on production deployments via VERCEL_ENV.
import type { LeaderboardEntry, LeaderboardPick } from "@/lib/leaderboard"
import { prisma } from "@/lib/prisma"
import { withRetry } from "@/lib/db-retry"

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

interface DemoResultsPick {
  pickType: string
  wasPlayed: boolean | null
  pointsEarned: number | null
  song: { name: string }
}

interface DemoResultsSubmission {
  showId: string
  totalPoints: number | null
  isScored: boolean
  picks: DemoResultsPick[]
  show?: { lockTime: Date | null }
}

/** Best real score for the show among non-demo, non-admin players. */
async function getDemoFieldBest(showId: string): Promise<number> {
  const best = await withRetry(
    () =>
      prisma.submission.findFirst({
        where: {
          showId,
          user: {
            isAdmin: false,
            AND: [
              { username: { not: "Funky20", mode: "insensitive" } },
              { username: { not: "PiperMaMa", mode: "insensitive" } },
            ],
          },
        },
        orderBy: { totalPoints: "desc" },
        select: { totalPoints: true },
      }),
    { operationName: "demo field best" }
  )
  return best?.totalPoints ?? 3
}

/** Mutates a Prisma-shaped submission so Funky20's picks and points match the demo leaderboard. */
function overrideFunkySubmission(
  submission: DemoResultsSubmission,
  targetPoints: number
): void {
  const encore = submission.picks.find((p) => p.pickType === "ENCORE")
  const opener = submission.picks.find((p) => p.pickType === "OPENER")
  const regulars = submission.picks.filter((p) => p.pickType === "REGULAR")

  if (opener) {
    opener.wasPlayed = false
    opener.pointsEarned = 0
  }
  if (encore) {
    encore.song.name = ENCORE_HIT
    encore.wasPlayed = true
    encore.pointsEarned = 3
  }

  const regularHitsNeeded = Math.min(
    Math.max(targetPoints - (encore ? 3 : 0), 0),
    regulars.length
  )
  const reserved = new Set([ENCORE_HIT, ...REGULAR_HITS])
  const spareNames = regulars
    .map((p) => p.song.name)
    .filter((name) => !reserved.has(name))
  regulars.forEach((pick, i) => {
    if (i < REGULAR_HITS.length) {
      pick.song.name = REGULAR_HITS[i]
    } else if (spareNames.length > 0) {
      pick.song.name = spareNames.shift() as string
    }
    pick.wasPlayed = i < regularHitsNeeded
    pick.pointsEarned = i < regularHitsNeeded ? 1 : 0
  })

  submission.totalPoints = submission.picks.reduce(
    (sum, p) => sum + (p.pointsEarned || 0),
    0
  )
  submission.isScored = true
}

/**
 * DEMO ONLY: if this user is Funky20, mutate his most recent locked
 * submission so the results pages agree with the demo leaderboard.
 */
export async function applyFunkyResultsDemoOverride(
  submissions: DemoResultsSubmission[],
  username: string | null | undefined
): Promise<void> {
  if (!username || username.toLowerCase() !== FIRST_PLACE_USER) return
  const now = new Date()
  const latest = submissions.find(
    (s) => s.isScored || (s.show?.lockTime && s.show.lockTime <= now)
  )
  if (!latest) return
  const fieldBest = await getDemoFieldBest(latest.showId)
  overrideFunkySubmission(latest, fieldBest + 2)
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
