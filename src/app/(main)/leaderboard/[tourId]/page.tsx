import { prisma } from "@/lib/prisma"
import { auth } from "@/lib/auth"
import { Metadata } from "next"
import { notFound } from "next/navigation"
import LeaderboardClient from "../LeaderboardClient"
import Link from "next/link"
import { ArrowLeft } from "lucide-react"

interface TourLeaderboardPageProps {
  params: Promise<{ tourId: string }>
}

export async function generateMetadata({
  params,
}: TourLeaderboardPageProps): Promise<Metadata> {
  const { tourId } = await params
  const tour = await prisma.tour.findUnique({
    where: { id: tourId },
  })

  if (!tour) {
    return {
      title: "Tour Not Found",
    }
  }

  return {
    title: `${tour.name} Leaderboard`,
    description: `View the final leaderboard and results for ${tour.name}.`,
    openGraph: {
      title: `${tour.name} Leaderboard | FantasyPhish`,
      description: `View the final leaderboard and results for ${tour.name}.`,
    },
  }
}

async function getLeaderboard(tourId: string) {
  // Get all scored submissions for this tour
  const now = new Date()
  const whereClause = {
    OR: [
      { isScored: true, show: { tourId } },
      { isScored: false, show: { lockTime: { lte: now }, tourId } },
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
  const rankedUsers = sortedUsers.map((user, index) => {
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

export default async function TourLeaderboardPage({
  params,
}: TourLeaderboardPageProps) {
  const { tourId } = await params
  const session = await auth()

  const tour = await prisma.tour.findUnique({
    where: { id: tourId },
    include: {
      shows: {
        orderBy: { showDate: "asc" },
        take: 1,
      },
    },
  })

  if (!tour) {
    notFound()
  }

  const leaderboard = await getLeaderboard(tourId)

  const currentUserRank = session?.user?.id
    ? leaderboard.find((u) => u.userId === session.user.id) || null
    : null

  const showForDisplay =
    tour.shows.length > 0
      ? {
          ...tour.shows[0],
          tour: {
            id: tour.id,
            name: tour.name,
            startDate: tour.startDate,
            endDate: tour.endDate,
            status: tour.status,
          },
        }
      : null

  return (
    <div className="space-y-6">
      {/* Back Link */}
      <Link
        href="/leaderboard/history"
        className="inline-flex items-center gap-2 text-orange-400 hover:text-orange-300"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to History
      </Link>

      {/* Leaderboard */}
      <LeaderboardClient
        leaderboard={leaderboard}
        nextShow={showForDisplay}
        currentUserRank={currentUserRank}
        currentUserId={session?.user?.id || null}
        hasPastTours={false}
      />
    </div>
  )
}
