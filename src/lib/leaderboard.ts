import { Prisma } from "@prisma/client"
import { prisma } from "@/lib/prisma"
import { withRetry } from "@/lib/db-retry"

export interface LeaderboardPick {
  songName: string
  wasPlayed: boolean | null
  pointsEarned: number
  pickType: string
}

export interface LeaderboardShowPicks {
  show: {
    showDate: Date
    venue: string
    city: string | null
    state: string | null
  }
  totalPoints: number
  picks: LeaderboardPick[]
}

export interface LeaderboardEntry {
  userId: string
  username: string
  totalPoints: number
  showsPlayed: number
  avgPoints: number
  accuracy: number
  rank: number
  picksByShow: LeaderboardShowPicks[]
}

export function tourSubmissionWhere(
  tourId?: string
): Prisma.SubmissionWhereInput {
  const now = new Date()
  return tourId
    ? {
        OR: [
          { isScored: true, show: { tourId } },
          { isScored: false, show: { lockTime: { lte: now }, tourId } },
        ],
      }
    : {
        OR: [
          { isScored: true },
          { isScored: false, show: { lockTime: { lte: now } } },
        ],
      }
}

export function showSubmissionWhere(
  showId: string
): Prisma.SubmissionWhereInput {
  const now = new Date()
  return {
    showId,
    OR: [
      { isScored: true },
      { isScored: false, show: { lockTime: { lte: now } } },
    ],
  }
}

export async function getLeaderboard(
  whereClause: Prisma.SubmissionWhereInput,
  operationName: string
): Promise<LeaderboardEntry[]> {
  const users = await withRetry(
    () =>
      prisma.user.findMany({
        where: {
          isAdmin: false,
          submissions: { some: whereClause },
        },
        select: {
          id: true,
          username: true,
          submissions: {
            where: whereClause,
            select: {
              totalPoints: true,
              show: {
                select: {
                  showDate: true,
                  venue: true,
                  city: true,
                  state: true,
                },
              },
              picks: {
                select: {
                  wasPlayed: true,
                  pointsEarned: true,
                  pickType: true,
                  song: { select: { name: true } },
                },
              },
            },
          },
        },
      }),
    { operationName }
  )

  const sortedUsers = users
    .map((user) => {
      const totalPoints = user.submissions.reduce(
        (sum, sub) => sum + (sub.totalPoints || 0),
        0
      )
      const totalPicks = user.submissions.length * 13
      const correctPicks = user.submissions.reduce(
        (sum, sub) => sum + sub.picks.filter((p) => p.wasPlayed).length,
        0
      )

      const picksByShow = user.submissions
        .map((sub) => ({
          show: sub.show,
          totalPoints: sub.totalPoints || 0,
          picks: sub.picks.map((pick) => ({
            songName: pick.song.name,
            wasPlayed: pick.wasPlayed,
            pointsEarned: pick.pointsEarned || 0,
            pickType: pick.pickType,
          })),
        }))
        .sort(
          (a, b) =>
            new Date(b.show.showDate).getTime() -
            new Date(a.show.showDate).getTime()
        )

      return {
        userId: user.id,
        username: user.username,
        totalPoints,
        showsPlayed: user.submissions.length,
        avgPoints:
          user.submissions.length > 0
            ? Math.round((totalPoints / user.submissions.length) * 10) / 10
            : 0,
        accuracy:
          totalPicks > 0 ? Math.round((correctPicks / totalPicks) * 100) : 0,
        picksByShow,
      }
    })
    .sort((a, b) => b.totalPoints - a.totalPoints)

  let currentRank = 1
  return sortedUsers.map((user, index) => {
    if (index > 0 && user.totalPoints !== sortedUsers[index - 1].totalPoints) {
      currentRank = index + 1
    }
    return {
      ...user,
      rank: currentRank,
    }
  })
}

export interface CurrentShowSummary {
  id: string
  showDate: Date
  venue: string
  city: string | null
  state: string | null
  isComplete: boolean
}

/** Most recent show whose picks have locked, within an optional tour. Used for the "This Show" leaderboard tab. */
export async function getCurrentOrLastShow(
  tourId?: string
): Promise<CurrentShowSummary | null> {
  const now = new Date()
  return withRetry(
    () =>
      prisma.show.findFirst({
        where: {
          ...(tourId ? { tourId } : {}),
          lockTime: { lte: now },
        },
        orderBy: { showDate: "desc" },
        select: {
          id: true,
          showDate: true,
          venue: true,
          city: true,
          state: true,
          isComplete: true,
        },
      }),
    { operationName: "find current or last show" }
  )
}
