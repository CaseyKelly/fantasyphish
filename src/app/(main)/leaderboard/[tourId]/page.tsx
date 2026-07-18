import { prisma } from "@/lib/prisma"
import { auth } from "@/lib/auth"
import { Metadata } from "next"
import { notFound } from "next/navigation"
import LeaderboardClient from "../LeaderboardClient"
import Link from "next/link"
import { ArrowLeft } from "lucide-react"
import { withRetry } from "@/lib/db-retry"
import {
  getLeaderboard,
  getCurrentOrLastShow,
  tourSubmissionWhere,
  showSubmissionWhere,
} from "@/lib/leaderboard"

interface TourLeaderboardPageProps {
  params: Promise<{ tourId: string }>
}

export async function generateMetadata({
  params,
}: TourLeaderboardPageProps): Promise<Metadata> {
  const { tourId } = await params
  const tour = await withRetry(
    () =>
      prisma.tour.findUnique({
        where: { id: tourId },
      }),
    { operationName: "find tour for metadata" }
  )

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
    alternates: {
      canonical: `/leaderboard/${tourId}`,
    },
  }
}

export default async function TourLeaderboardPage({
  params,
}: TourLeaderboardPageProps) {
  const { tourId } = await params
  const session = await auth()

  const tour = await withRetry(
    () =>
      prisma.tour.findUnique({
        where: { id: tourId },
        include: {
          shows: {
            orderBy: { showDate: "asc" },
            take: 1,
          },
        },
      }),
    { operationName: "find tour" }
  )

  if (!tour) {
    notFound()
  }

  const tourLeaderboard = await getLeaderboard(
    tourSubmissionWhere(tourId),
    "find tour leaderboard users"
  )

  const currentShow = await getCurrentOrLastShow(tourId)
  const showLeaderboard = currentShow
    ? await getLeaderboard(
        showSubmissionWhere(currentShow.id),
        "find show leaderboard users"
      )
    : []

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
        tourLeaderboard={tourLeaderboard}
        showLeaderboard={showLeaderboard}
        currentShow={currentShow}
        nextShow={showForDisplay}
        currentUserId={session?.user?.id || null}
        hasPastTours={false}
      />
    </div>
  )
}
