import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { redirect } from "next/navigation"
import { format } from "date-fns"
import {
  Trophy,
  Target,
  Percent,
  Calendar,
  MapPin,
  Check,
  X,
  Clock,
} from "lucide-react"
import { Card, CardContent, CardHeader } from "@/components/ui/card"

async function getHistory(userId: string) {
  const submissions = await prisma.submission.findMany({
    where: { userId },
    include: {
      show: {
        include: { tour: true },
      },
      picks: {
        include: { song: true },
        orderBy: { pickType: "asc" },
      },
    },
    orderBy: {
      show: { showDate: "desc" },
    },
  })

  const scoredSubmissions = submissions.filter((s) => s.isScored)
  const totalPoints = scoredSubmissions.reduce(
    (sum, s) => sum + (s.totalPoints || 0),
    0
  )
  const totalPicks = scoredSubmissions.length * 13
  const correctPicks = scoredSubmissions.reduce(
    (sum, s) => sum + s.picks.filter((p) => p.wasPlayed).length,
    0
  )

  return {
    submissions,
    stats: {
      totalSubmissions: submissions.length,
      scoredSubmissions: scoredSubmissions.length,
      totalPoints,
      avgPoints:
        scoredSubmissions.length > 0
          ? Math.round((totalPoints / scoredSubmissions.length) * 10) / 10
          : 0,
      correctPicks,
      totalPicks,
      accuracy:
        totalPicks > 0 ? Math.round((correctPicks / totalPicks) * 100) : 0,
    },
  }
}

export default async function HistoryPage() {
  const session = await auth()
  if (!session?.user?.id) {
    redirect("/login")
  }

  const { submissions, stats } = await getHistory(session.user.id)

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-white">My Picks History</h1>
        <p className="text-slate-400 mt-1">
          View your past submissions and scores
        </p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center space-x-3">
              <div className="p-2 bg-orange-500/20 rounded-lg">
                <Trophy className="h-5 w-5 text-orange-500" />
              </div>
              <div>
                <p className="text-2xl font-bold text-white">
                  {stats.totalPoints}
                </p>
                <p className="text-sm text-slate-400">Total Points</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center space-x-3">
              <div className="p-2 bg-blue-500/20 rounded-lg">
                <Target className="h-5 w-5 text-blue-500" />
              </div>
              <div>
                <p className="text-2xl font-bold text-white">
                  {stats.avgPoints}
                </p>
                <p className="text-sm text-slate-400">Avg Points</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center space-x-3">
              <div className="p-2 bg-green-500/20 rounded-lg">
                <Percent className="h-5 w-5 text-green-500" />
              </div>
              <div>
                <p className="text-2xl font-bold text-white">
                  {stats.accuracy}%
                </p>
                <p className="text-sm text-slate-400">Accuracy</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center space-x-3">
              <div className="p-2 bg-purple-500/20 rounded-lg">
                <Calendar className="h-5 w-5 text-purple-500" />
              </div>
              <div>
                <p className="text-2xl font-bold text-white">
                  {stats.scoredSubmissions}
                </p>
                <p className="text-sm text-slate-400">Shows Scored</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Submissions List */}
      {submissions.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Calendar className="h-12 w-12 text-slate-500 mx-auto mb-4" />
            <p className="text-slate-400">
              You haven&apos;t made any picks yet. Head to the dashboard to get
              started!
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-6">
          {submissions.map((submission) => (
            <Card key={submission.id}>
              <CardHeader>
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                  <div>
                    <h3 className="font-semibold text-white text-lg">
                      {submission.show.venue}
                    </h3>
                    <div className="flex items-center space-x-4 text-sm text-slate-400 mt-1">
                      <span className="flex items-center">
                        <MapPin className="h-4 w-4 mr-1" />
                        {submission.show.city},{" "}
                        {submission.show.state || submission.show.country}
                      </span>
                      <span className="flex items-center">
                        <Calendar className="h-4 w-4 mr-1" />
                        {format(submission.show.showDate, "MMM d, yyyy")}
                      </span>
                    </div>
                  </div>
                  <div className="text-left sm:text-right">
                    {submission.isScored ? (
                      <div>
                        <p className="text-3xl font-bold text-orange-500">
                          {submission.totalPoints}
                        </p>
                        <p className="text-sm text-slate-400">points</p>
                      </div>
                    ) : (
                      <span className="flex items-center text-slate-400">
                        <Clock className="h-4 w-4 mr-1" />
                        Awaiting results
                      </span>
                    )}
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {/* Special Picks */}
                  <div className="grid sm:grid-cols-2 gap-4">
                    {submission.picks
                      .filter((p) => p.pickType !== "REGULAR")
                      .map((pick) => (
                        <div
                          key={pick.id}
                          className={`flex items-center justify-between p-3 rounded-lg ${
                            submission.isScored
                              ? pick.wasPlayed
                                ? "bg-green-500/10 border border-green-500/30"
                                : "bg-red-500/10 border border-red-500/30"
                              : "bg-slate-700/50"
                          }`}
                        >
                          <div>
                            <p className="text-xs text-slate-400 uppercase mb-1">
                              {pick.pickType === "OPENER" ? "Opener" : "Encore"}
                            </p>
                            <p className="font-medium text-white">
                              {pick.song.name}
                            </p>
                          </div>
                          {submission.isScored && (
                            <div className="flex items-center space-x-2">
                              <span
                                className={`font-bold ${
                                  pick.wasPlayed
                                    ? "text-green-400"
                                    : "text-red-400"
                                }`}
                              >
                                {pick.wasPlayed ? "+3" : "0"}
                              </span>
                              {pick.wasPlayed ? (
                                <Check className="h-5 w-5 text-green-400" />
                              ) : (
                                <X className="h-5 w-5 text-red-400" />
                              )}
                            </div>
                          )}
                        </div>
                      ))}
                  </div>

                  {/* Regular Picks */}
                  <div>
                    <p className="text-sm text-slate-400 mb-2">Regular Picks</p>
                    <div className="flex flex-wrap gap-2">
                      {submission.picks
                        .filter((p) => p.pickType === "REGULAR")
                        .map((pick) => (
                          <span
                            key={pick.id}
                            className={`px-3 py-1.5 rounded-full text-sm flex items-center space-x-1 ${
                              submission.isScored
                                ? pick.wasPlayed
                                  ? "bg-green-500/20 text-green-400"
                                  : "bg-slate-700 text-slate-400"
                                : "bg-slate-700 text-white"
                            }`}
                          >
                            <span>{pick.song.name}</span>
                            {submission.isScored && pick.wasPlayed && (
                              <Check className="h-3 w-3" />
                            )}
                          </span>
                        ))}
                    </div>
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
