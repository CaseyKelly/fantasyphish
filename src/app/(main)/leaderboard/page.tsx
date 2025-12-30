import { prisma } from "@/lib/prisma"
import { auth } from "@/lib/auth"
import { Metadata } from "next"
import LeaderboardClient from "./LeaderboardClient"

export const metadata: Metadata = {
  title: "Leaderboard",
  description:
    "View the FantasyPhish tour leaderboard and see how you rank against other Phish fans in predicting setlists.",
  openGraph: {
    title: "Leaderboard | FantasyPhish",
    description:
      "View the FantasyPhish tour leaderboard and see how you rank against other Phish fans in predicting setlists.",
  },
  alternates: {
    canonical: "/leaderboard",
  },
}

interface LeaderboardPageProps {
  searchParams: Promise<{ tourId?: string }>
}

async function getNextShow() {
  const now = new Date()

  // First try to find shows with lockTime set (timezone-aware)
  const nextShow = await prisma.show.findFirst({
    where: {
      isComplete: false,
      OR: [
        {
          lockTime: {
            gte: now,
          },
        },
        {
          lockTime: null,
          showDate: {
            gte: now,
          },
        },
      ],
    },
    orderBy: { showDate: "asc" },
    include: {
      tour: true,
    },
  })

  return nextShow
}

async function getLeaderboard(tourId?: string) {
  // Include submissions that are either scored OR locked (show has started)
  const now = new Date()
  const whereClause = tourId
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

  const users = await prisma.user.findMany({
    where: {
      isAdmin: false,
      submissions: {
        some: whereClause,
      },
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
              song: {
                select: {
                  name: true,
                },
              },
            },
          },
        },
      },
    },
  })

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

      // Aggregate all picks from all submissions for this user, organized by show
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

  // Assign ranks with tie handling
  let currentRank = 1
  const rankedUsers = sortedUsers.map((user, index) => {
    // If not the first user and points are different from previous, update rank
    if (index > 0 && user.totalPoints !== sortedUsers[index - 1].totalPoints) {
      currentRank = index + 1
    }
    return {
      ...user,
      rank: currentRank,
    }
  })

  return rankedUsers
}

export default async function LeaderboardPage({
  searchParams,
}: LeaderboardPageProps) {
  const session = await auth()
  const params = await searchParams
  const tourId = params.tourId

  const nextShow = await getNextShow()
  const currentTourId = tourId || nextShow?.tourId || undefined
  const leaderboard = await getLeaderboard(currentTourId)

  const currentUserRank = session?.user?.id
    ? leaderboard.find((u) => u.userId === session.user.id) || null
    : null

  // Check if there are any in-progress shows for this tour
  const hasInProgressShows = await prisma.show.findFirst({
    where: {
      tourId: currentTourId,
      isComplete: false,
      lockTime: {
        lte: new Date(),
      },
    },
  })

  return (
    <LeaderboardClient
      leaderboard={leaderboard}
      nextShow={nextShow}
      currentUserRank={currentUserRank}
      currentUserId={session?.user?.id || null}
      hasInProgressShows={!!hasInProgressShows}
    />
  )
}
