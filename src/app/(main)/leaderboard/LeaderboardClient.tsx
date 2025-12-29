"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import {
  Trophy,
  Medal,
  User,
  TrendingUp,
  Calendar,
  MapPin,
  Check,
  ChevronDown,
} from "lucide-react"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { parseUTCDate } from "@/lib/date-utils"

interface Pick {
  songName: string
  wasPlayed: boolean | null
  pointsEarned: number
}

interface LeaderboardEntry {
  userId: string
  username: string
  totalPoints: number
  showsPlayed: number
  avgPoints: number
  accuracy: number
  rank: number
  picks: Pick[]
}

interface Show {
  venue: string
  city: string | null
  state: string | null
  showDate: Date
  tour: {
    name: string
    startDate: Date
    endDate: Date | null
  } | null
}

interface LeaderboardClientProps {
  leaderboard: LeaderboardEntry[]
  nextShow: Show | null
  currentUserRank: LeaderboardEntry | null
  currentUserId: string | null
  hasInProgressShows: boolean
}

export default function LeaderboardClient({
  leaderboard,
  nextShow,
  currentUserRank,
  currentUserId,
  hasInProgressShows,
}: LeaderboardClientProps) {
  const router = useRouter()
  const [expandedUserId, setExpandedUserId] = useState<string | null>(null)

  // Poll for updates if there are in-progress shows
  useEffect(() => {
    if (!hasInProgressShows) return

    const interval = setInterval(() => {
      router.refresh()
    }, 60000) // 60 seconds

    return () => clearInterval(interval)
  }, [hasInProgressShows, router])

  const toggleExpanded = (userId: string, e: React.MouseEvent) => {
    e.stopPropagation()
    setExpandedUserId(expandedUserId === userId ? null : userId)
  }

  const getRankIcon = (rank: number) => {
    switch (rank) {
      case 1:
        return <Trophy className="h-6 w-6 text-yellow-500" />
      case 2:
        return <Medal className="h-6 w-6 text-gray-400" />
      case 3:
        return <Medal className="h-6 w-6 text-amber-600" />
      default:
        return (
          <span className="w-6 h-6 flex items-center justify-center text-slate-400 font-medium">
            {rank}
          </span>
        )
    }
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-white">Leaderboard</h1>
      </div>

      {/* Current Tour Info */}
      {nextShow?.tour && (
        <Card className="bg-slate-800/50 border-slate-700">
          <CardContent className="py-4">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div className="flex items-center space-x-4">
                <div className="p-2 bg-orange-500/20 rounded-lg">
                  <Calendar className="h-5 w-5 text-orange-500" />
                </div>
                <div>
                  <p className="font-semibold text-white">
                    {nextShow.tour.name}
                  </p>
                  <p className="text-sm text-slate-400">
                    {parseUTCDate(nextShow.tour.startDate, "MMM d, yyyy")}
                    {nextShow.tour.endDate && (
                      <>
                        {" "}
                        - {parseUTCDate(nextShow.tour.endDate, "MMM d, yyyy")}
                      </>
                    )}
                  </p>
                </div>
              </div>
              {nextShow.venue && (
                <div className="flex items-center space-x-2 text-sm text-slate-400">
                  <MapPin className="h-4 w-4" />
                  <span>
                    Next: {nextShow.venue}
                    {nextShow.city && `, ${nextShow.city}`}
                    {nextShow.state && `, ${nextShow.state}`} •{" "}
                    {parseUTCDate(nextShow.showDate, "MMM d")}
                  </span>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Current User Rank */}
      {currentUserRank && (
        <Card className="bg-orange-500/10 border-orange-500/30">
          <CardContent className="py-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-4">
                <div className="p-2 bg-orange-500/20 rounded-lg">
                  <User className="h-5 w-5 text-orange-500" />
                </div>
                <div>
                  <p className="font-semibold text-white">Your Rank</p>
                  <p className="text-sm text-slate-400">
                    {currentUserRank.showsPlayed} shows played
                  </p>
                </div>
              </div>
              <div className="text-right">
                <p className="text-3xl font-bold text-orange-500">
                  #{currentUserRank.rank}
                </p>
                <p className="text-sm text-slate-400">
                  {currentUserRank.totalPoints} pts
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Leaderboard Table */}
      {leaderboard.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Trophy className="h-12 w-12 text-slate-500 mx-auto mb-4" />
            <p className="text-slate-400">No scores yet for this tour.</p>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader className="border-b border-slate-700">
            <div className="grid grid-cols-12 text-sm font-medium text-slate-400 gap-2 items-center">
              <div className="col-span-1">Rank</div>
              <div className="col-span-5 sm:col-span-3">Player</div>
              <div className="col-span-3 sm:col-span-2 text-center">Shows</div>
              <div className="col-span-2 text-center hidden sm:block">Avg</div>
              <div className="col-span-2 text-right">Points</div>
              <div className="col-span-1 sm:col-span-2 flex justify-center">
                View Picks
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <div className="divide-y divide-slate-700/50">
              {leaderboard.map((user) => {
                const isCurrentUser = currentUserId === user.userId
                const isExpanded = expandedUserId === user.userId

                // Show scoring picks first, then non-scoring
                const scoringPicks = user.picks.filter(
                  (p) => p.pointsEarned > 0
                )
                const nonScoringPicks = user.picks.filter(
                  (p) => p.pointsEarned === 0
                )
                const allPicksSorted = [...scoringPicks, ...nonScoringPicks]

                return (
                  <div
                    key={user.userId}
                    className={`px-4 sm:px-6 py-4 ${
                      isCurrentUser ? "bg-orange-500/5" : ""
                    }`}
                  >
                    {/* Main row with rank, username, stats */}
                    <div className="grid grid-cols-12 items-center gap-2">
                      <div className="col-span-1">{getRankIcon(user.rank)}</div>
                      <div className="col-span-5 sm:col-span-3">
                        <p
                          className={`font-medium ${
                            isCurrentUser ? "text-orange-400" : "text-white"
                          }`}
                        >
                          {user.username}
                          {isCurrentUser && (
                            <span className="ml-2 text-xs text-orange-400">
                              (You)
                            </span>
                          )}
                        </p>
                        <p className="text-xs text-slate-500 sm:hidden">
                          {user.avgPoints} avg
                        </p>
                      </div>
                      <div className="col-span-3 sm:col-span-2 text-center text-slate-400">
                        {user.showsPlayed}
                      </div>
                      <div className="col-span-2 text-center text-slate-400 hidden sm:block">
                        {user.avgPoints}
                      </div>
                      <div className="col-span-2 text-right">
                        <span className="text-xl font-bold text-white">
                          {user.totalPoints}
                        </span>
                      </div>
                      <div className="col-span-1 sm:col-span-2 flex justify-center">
                        <button
                          onClick={(e) => toggleExpanded(user.userId, e)}
                          className="p-2 text-slate-400 hover:text-white hover:bg-slate-700/50 rounded-lg transition-colors"
                          aria-label="View picks"
                        >
                          <ChevronDown
                            className={`h-4 w-4 transition-transform ${
                              isExpanded ? "rotate-180" : ""
                            }`}
                          />
                        </button>
                      </div>
                    </div>

                    {/* Expanded song picks */}
                    {isExpanded && allPicksSorted.length > 0 && (
                      <div className="mt-3 pt-3 border-t border-slate-700/50">
                        <div className="flex flex-wrap gap-1.5">
                          {allPicksSorted.map((pick, idx) => (
                            <div
                              key={idx}
                              className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs ${
                                pick.pointsEarned > 0
                                  ? "bg-green-500/20 text-green-400 border border-green-500/30"
                                  : "bg-slate-700/50 text-slate-400 border border-slate-600/30"
                              }`}
                            >
                              {pick.pointsEarned > 0 && (
                                <Check className="h-3 w-3" />
                              )}
                              <span>{pick.songName}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Stats Legend */}
      <div className="flex items-center justify-center space-x-6 text-sm text-slate-500">
        <span className="flex items-center">
          <TrendingUp className="h-4 w-4 mr-1" />
          Points are cumulative per tour
        </span>
      </div>
    </div>
  )
}
