import { prisma } from "@/lib/prisma"
import { auth } from "@/lib/auth"
import { Metadata } from "next"
import LeaderboardClient from "./LeaderboardClient"
import { withRetry } from "@/lib/db-retry"
import {
  getLeaderboard,
  getCurrentOrLastShow,
  tourSubmissionWhere,
  showSubmissionWhere,
} from "@/lib/leaderboard"
import {
  applyShowDemoOverride,
  isDemoOverrideEnabled,
} from "@/lib/demo-leaderboard-override"

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
  const nextShow = await withRetry(
    () =>
      prisma.show.findFirst({
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
      }),
    { operationName: "find next show (leaderboard)" }
  )

  return nextShow
}

async function getCurrentTour() {
  const now = new Date()

  // Priority order:
  // 1. COMPLETED tours (manually marked, showing final podium)
  // 2. ACTIVE tours with locked incomplete shows (tour currently happening)
  // 3. ACTIVE tours where all shows are complete (awaiting manual COMPLETED status)
  // 4. ACTIVE tours with any incomplete shows (upcoming tour)

  // 1. Prioritize COMPLETED tours (all shows complete, showing podium)
  const completedTour = await withRetry(
    () =>
      prisma.tour.findFirst({
        where: {
          status: "COMPLETED",
          shows: {
            some: {}, // Has at least one show
          },
        },
        orderBy: { endDate: "desc" }, // Most recent completed tour first
        include: {
          shows: {
            orderBy: { showDate: "asc" },
            take: 1,
          },
        },
      }),
    { operationName: "find completed tour" }
  )

  if (completedTour) return completedTour

  // 2. Check for ACTIVE tour with locked incomplete shows (tour currently happening)
  const activeTour = await withRetry(
    () =>
      prisma.tour.findFirst({
        where: {
          status: "ACTIVE",
          shows: {
            some: {
              isComplete: false,
              lockTime: {
                lte: now,
              },
            },
          },
        },
        orderBy: { startDate: "asc" },
        include: {
          shows: {
            where: { isComplete: false },
            orderBy: { showDate: "asc" },
            take: 1,
          },
        },
      }),
    { operationName: "find active tour" }
  )

  if (activeTour) return activeTour

  // 3. Check for ACTIVE tour where all shows are complete (needs manual COMPLETED status update)
  const finishedActiveTour = await withRetry(
    () =>
      prisma.tour.findFirst({
        where: {
          status: "ACTIVE",
          shows: {
            every: {
              isComplete: true,
            },
          },
        },
        orderBy: { endDate: "desc" },
        include: {
          shows: {
            orderBy: { showDate: "asc" },
            take: 1,
          },
        },
      }),
    { operationName: "find finished active tour" }
  )

  if (finishedActiveTour) return finishedActiveTour

  // 4. Fall back to next upcoming ACTIVE tour with incomplete shows
  // Note: FUTURE tours are excluded - they don't show on leaderboard until activated
  const upcomingTour = await withRetry(
    () =>
      prisma.tour.findFirst({
        where: {
          status: "ACTIVE",
          shows: {
            some: {
              isComplete: false,
            },
          },
        },
        orderBy: { startDate: "asc" },
        include: {
          shows: {
            where: { isComplete: false },
            orderBy: { showDate: "asc" },
            take: 1,
          },
        },
      }),
    { operationName: "find upcoming active tour" }
  )

  return upcomingTour
}

export default async function LeaderboardPage({
  searchParams,
}: LeaderboardPageProps) {
  const session = await auth()
  const params = await searchParams
  const tourId = params.tourId

  const nextShow = await getNextShow()
  const currentTour = await getCurrentTour()
  // Prioritize: manual tourId > active tour (locked shows) > next show
  const currentTourId =
    tourId || currentTour?.id || nextShow?.tourId || undefined
  const tourLeaderboard = await getLeaderboard(
    tourSubmissionWhere(currentTourId),
    "find tour leaderboard users"
  )

  const currentShow = await getCurrentOrLastShow(currentTourId)
  let showLeaderboard = currentShow
    ? await getLeaderboard(
        showSubmissionWhere(currentShow.id),
        "find show leaderboard users"
      )
    : []
  // DEMO ONLY (preview/leaderboard-demo-donotmerge): no-op in production.
  if (isDemoOverrideEnabled()) {
    showLeaderboard = applyShowDemoOverride(showLeaderboard)
  }

  // Check if there are any in-progress shows for this tour
  const hasInProgressShows = await withRetry(
    () =>
      prisma.show.findFirst({
        where: {
          tourId: currentTourId,
          isComplete: false,
          lockTime: {
            lte: new Date(),
          },
        },
      }),
    { operationName: "find in-progress shows" }
  )

  // Show the tour info from the current tour being displayed in the leaderboard
  const showForDisplay =
    currentTour && currentTour.shows.length > 0
      ? {
          ...currentTour.shows[0],
          tour: {
            id: currentTour.id,
            name: currentTour.name,
            startDate: currentTour.startDate,
            endDate: currentTour.endDate,
            status: currentTour.status,
          },
        }
      : nextShow

  // Check if there are any past tours with data to show
  const hasPastTours =
    (await withRetry(
      () =>
        prisma.tour.count({
          where: {
            status: "CLOSED",
            shows: {
              some: {
                submissions: {
                  some: {
                    isScored: true,
                  },
                },
              },
            },
          },
        }),
      { operationName: "count past tours" }
    )) > 0

  return (
    <LeaderboardClient
      tourLeaderboard={tourLeaderboard}
      showLeaderboard={showLeaderboard}
      currentShow={currentShow}
      nextShow={showForDisplay}
      currentUserId={session?.user?.id || null}
      hasPastTours={hasPastTours}
    />
  )
}
