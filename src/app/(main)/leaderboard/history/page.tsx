import { prisma } from "@/lib/prisma"
import { Metadata } from "next"
import Link from "next/link"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { Trophy, Calendar, ArrowRight } from "lucide-react"
import { parseUTCDate } from "@/lib/date-utils"

export const metadata: Metadata = {
  title: "Leaderboard History",
  description:
    "View past FantasyPhish tour results and winners from previous tours.",
  openGraph: {
    title: "Leaderboard History | FantasyPhish",
    description:
      "View past FantasyPhish tour results and winners from previous tours.",
  },
  alternates: {
    canonical: "/leaderboard/history",
  },
}

interface TourWithWinners {
  id: string
  name: string
  startDate: Date
  endDate: Date | null
  showCount: number
  participantCount: number
  topThree: Array<{
    rank: number
    username: string
    totalPoints: number
  }>
}

async function getPastTours(): Promise<TourWithWinners[]> {
  const closedTours = await prisma.tour.findMany({
    where: {
      status: "CLOSED",
    },
    orderBy: { endDate: "desc" },
    include: {
      shows: {
        select: {
          id: true,
        },
      },
    },
  })

  const toursWithWinners: TourWithWinners[] = []

  for (const tour of closedTours) {
    // Get all scored submissions for this tour
    const submissions = await prisma.submission.findMany({
      where: {
        show: {
          tourId: tour.id,
        },
        isScored: true,
      },
      include: {
        user: {
          select: {
            id: true,
            username: true,
            isAdmin: true,
          },
        },
      },
    })

    // Calculate standings
    const userScores = new Map<
      string,
      { userId: string; username: string; totalPoints: number }
    >()

    for (const submission of submissions) {
      // Skip admin users
      if (submission.user.isAdmin) continue

      const existing = userScores.get(submission.userId)
      if (existing) {
        existing.totalPoints += submission.totalPoints || 0
      } else {
        userScores.set(submission.userId, {
          userId: submission.userId,
          username: submission.user.username,
          totalPoints: submission.totalPoints || 0,
        })
      }
    }

    const standings = Array.from(userScores.values())
      .sort((a, b) => b.totalPoints - a.totalPoints)
      .slice(0, 3)

    toursWithWinners.push({
      id: tour.id,
      name: tour.name,
      startDate: tour.startDate,
      endDate: tour.endDate,
      showCount: tour.shows.length,
      participantCount: userScores.size,
      topThree: standings.map((s, index) => ({
        rank: index + 1,
        username: s.username,
        totalPoints: s.totalPoints,
      })),
    })
  }

  return toursWithWinners
}

export default async function LeaderboardHistoryPage() {
  const pastTours = await getPastTours()

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-white">Leaderboard History</h1>
          <p className="text-slate-400 mt-2">
            Past tour results and championship winners
          </p>
        </div>
        <Link
          href="/leaderboard"
          className="text-orange-400 hover:text-orange-300 flex items-center gap-2"
        >
          Current Leaderboard
          <ArrowRight className="h-4 w-4" />
        </Link>
      </div>

      {/* Past Tours */}
      {pastTours.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Trophy className="h-12 w-12 text-slate-500 mx-auto mb-4" />
            <p className="text-slate-400">No past tours yet.</p>
            <p className="text-sm text-slate-500 mt-2">
              Completed tours will appear here.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-6">
          {pastTours.map((tour) => (
            <Card
              key={tour.id}
              className="bg-slate-800/50 border-slate-700 hover:border-orange-500/50 transition-colors"
            >
              <CardHeader className="border-b border-slate-700">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <div className="p-2 bg-orange-500/20 rounded-lg">
                      <Calendar className="h-5 w-5 text-orange-500" />
                    </div>
                    <div>
                      <h2 className="text-xl font-semibold text-white">
                        {tour.name}
                      </h2>
                      <p className="text-sm text-slate-400">
                        {parseUTCDate(tour.startDate, "MMM d, yyyy")}
                        {tour.endDate && (
                          <> - {parseUTCDate(tour.endDate, "MMM d, yyyy")}</>
                        )}
                      </p>
                    </div>
                  </div>
                  <Link
                    href={`/leaderboard/${tour.id}`}
                    className="text-orange-400 hover:text-orange-300 flex items-center gap-2 text-sm"
                  >
                    View Full Results
                    <ArrowRight className="h-4 w-4" />
                  </Link>
                </div>
              </CardHeader>
              <CardContent className="pt-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Tour Stats */}
                  <div className="space-y-2">
                    <p className="text-sm text-slate-400">
                      {tour.showCount} show{tour.showCount !== 1 ? "s" : ""} •{" "}
                      {tour.participantCount} participant
                      {tour.participantCount !== 1 ? "s" : ""}
                    </p>
                  </div>

                  {/* Top 3 Winners */}
                  <div className="space-y-2">
                    <p className="text-sm font-medium text-slate-300 mb-3">
                      🏆 Championship Winners
                    </p>
                    {tour.topThree.length === 0 ? (
                      <p className="text-sm text-slate-500">No participants</p>
                    ) : (
                      <div className="space-y-2">
                        {tour.topThree.map((winner) => {
                          const medal =
                            winner.rank === 1
                              ? "🥇"
                              : winner.rank === 2
                                ? "🥈"
                                : "🥉"
                          return (
                            <div
                              key={winner.rank}
                              className="flex items-center justify-between text-sm"
                            >
                              <span className="text-slate-300">
                                {medal} #{winner.rank} {winner.username}
                              </span>
                              <span className="font-semibold text-orange-400">
                                {winner.totalPoints} pts
                              </span>
                            </div>
                          )
                        })}
                      </div>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
