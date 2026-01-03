"use client"

import { useState } from "react"
import Link from "next/link"
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
  pickType: string
}

interface ShowPicks {
  show: {
    showDate: Date
    venue: string
    city: string | null
    state: string | null
  }
  totalPoints: number
  picks: Pick[]
}

interface LeaderboardEntry {
  userId: string
  username: string
  totalPoints: number
  showsPlayed: number
  avgPoints: number
  accuracy: number
  rank: number
  picksByShow: ShowPicks[]
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
    status: "FUTURE" | "ACTIVE" | "COMPLETED" | "CLOSED"
  } | null
}

interface LeaderboardClientProps {
  leaderboard: LeaderboardEntry[]
  nextShow: Show | null
  currentUserRank: LeaderboardEntry | null
  currentUserId: string | null
  hasPastTours: boolean
}

export default function LeaderboardClient({
  leaderboard,
  nextShow,
  currentUserRank,
  currentUserId,
  hasPastTours,
}: LeaderboardClientProps) {
  const [expandedUserIds, setExpandedUserIds] = useState<Set<string>>(new Set())

  const toggleExpanded = (userId: string) => {
    setExpandedUserIds((prev) => {
      const next = new Set(prev)
      if (next.has(userId)) {
        next.delete(userId)
      } else {
        next.add(userId)
      }
      return next
    })
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
        <Card
          className={
            nextShow.tour.status === "COMPLETED"
              ? "bg-gradient-to-r from-yellow-500/20 to-orange-500/20 border-2 border-yellow-500/50"
              : "bg-[#233d4d]/90 border-2 border-[#4a6b7d]/60"
          }
        >
          <CardContent className="py-4">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div className="flex items-center space-x-4">
                <div
                  className={
                    nextShow.tour.status === "COMPLETED"
                      ? "p-2 bg-yellow-500/20 rounded-lg"
                      : "p-2 bg-orange-500/20 rounded-lg"
                  }
                >
                  {nextShow.tour.status === "COMPLETED" ? (
                    <Trophy className="h-5 w-5 text-yellow-500" />
                  ) : (
                    <Calendar className="h-5 w-5 text-orange-500" />
                  )}
                </div>
                <div>
                  <p
                    className={
                      nextShow.tour.status === "COMPLETED"
                        ? "font-semibold text-yellow-400"
                        : "font-semibold text-white"
                    }
                  >
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
              {nextShow.tour.status === "COMPLETED" ? (
                <div className="flex items-center space-x-2 text-sm">
                  <Trophy className="h-4 w-4 text-yellow-500" />
                  <span className="font-semibold text-yellow-400">
                    Tour Complete - Final Results
                  </span>
                </div>
              ) : (
                nextShow.venue && (
                  <div className="flex items-center space-x-2 text-sm text-slate-400">
                    <MapPin className="h-4 w-4" />
                    <span>
                      Next: {nextShow.venue}
                      {nextShow.city && `, ${nextShow.city}`}
                      {nextShow.state && `, ${nextShow.state}`} •{" "}
                      {parseUTCDate(nextShow.showDate, "MMM d")}
                    </span>
                  </div>
                )
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Podium Display for Completed Tours */}
      {nextShow?.tour?.status === "COMPLETED" && leaderboard.length >= 3 && (
        <Card className="bg-gradient-to-b from-[#233d4d]/80 to-[#1e3340]/80 border-2 border-[#4a6b7d]/60">
          <CardContent className="py-8 px-4">
            <div
              className="flex items-end justify-center gap-4 sm:gap-8 max-w-3xl mx-auto"
              role="region"
              aria-label="Tournament podium"
            >
              {/* 2nd Place */}
              <div className="flex flex-col items-center flex-1">
                <div className="mb-3 relative">
                  <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-full bg-gradient-to-br from-gray-300 to-gray-500 flex items-center justify-center shadow-lg">
                    <Medal className="h-8 w-8 sm:h-10 sm:w-10 text-white" />
                  </div>
                  <div className="absolute -top-1 -right-1 w-6 h-6 sm:w-7 sm:h-7 rounded-full bg-slate-700 border-2 border-gray-400 flex items-center justify-center">
                    <span className="text-xs sm:text-sm font-bold text-gray-300">
                      2
                    </span>
                  </div>
                </div>
                <Link
                  href={`/user/${leaderboard[1].username}`}
                  className="font-semibold text-sm sm:text-base text-white hover:text-gray-300 transition-colors text-center mb-1 line-clamp-1 max-w-full"
                  aria-label={`Second place winner: ${leaderboard[1].username}`}
                >
                  {leaderboard[1].username}
                </Link>
                <div className="text-xl sm:text-2xl font-bold text-gray-300 mb-2">
                  {leaderboard[1].totalPoints}
                </div>
                <div className="w-full bg-gradient-to-t from-gray-400/30 to-gray-300/30 rounded-t-lg border-2 border-gray-400/50 px-3 py-3 sm:py-4 flex flex-col items-center">
                  <div className="text-xs text-gray-300 font-medium">
                    Silver
                  </div>
                  <div className="text-2xl sm:text-3xl font-bold text-gray-200 mt-1">
                    2nd
                  </div>
                </div>
              </div>

              {/* 1st Place */}
              <div className="flex flex-col items-center flex-1">
                <div className="mb-3 relative">
                  <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-full bg-gradient-to-br from-yellow-300 via-yellow-400 to-yellow-600 flex items-center justify-center shadow-2xl shadow-yellow-500/50 animate-pulse">
                    <Trophy className="h-10 w-10 sm:h-12 sm:w-12 text-yellow-900" />
                  </div>
                  <div className="absolute -top-1 -right-1 w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-slate-700 border-2 border-yellow-400 flex items-center justify-center">
                    <span className="text-sm sm:text-base font-bold text-yellow-400">
                      1
                    </span>
                  </div>
                </div>
                <Link
                  href={`/user/${leaderboard[0].username}`}
                  className="font-bold text-base sm:text-lg text-yellow-400 hover:text-yellow-300 transition-colors text-center mb-1 line-clamp-1 max-w-full"
                  aria-label={`First place winner: ${leaderboard[0].username}`}
                >
                  {leaderboard[0].username}
                </Link>
                <div className="text-2xl sm:text-3xl font-bold text-yellow-400 mb-2">
                  {leaderboard[0].totalPoints}
                </div>
                <div className="w-full bg-gradient-to-t from-yellow-600/30 to-yellow-400/30 rounded-t-lg border-2 border-yellow-400/50 px-3 py-5 sm:py-6 flex flex-col items-center">
                  <div className="text-xs text-yellow-300 font-medium">
                    Gold
                  </div>
                  <div className="text-3xl sm:text-4xl font-bold text-yellow-400 mt-1">
                    1st
                  </div>
                </div>
              </div>

              {/* 3rd Place */}
              <div className="flex flex-col items-center flex-1">
                <div className="mb-3 relative">
                  <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-full bg-gradient-to-br from-amber-600 to-amber-800 flex items-center justify-center shadow-lg">
                    <Medal className="h-8 w-8 sm:h-10 sm:w-10 text-amber-200" />
                  </div>
                  <div className="absolute -top-1 -right-1 w-6 h-6 sm:w-7 sm:h-7 rounded-full bg-slate-700 border-2 border-amber-600 flex items-center justify-center">
                    <span className="text-xs sm:text-sm font-bold text-amber-400">
                      3
                    </span>
                  </div>
                </div>
                <Link
                  href={`/user/${leaderboard[2].username}`}
                  className="font-semibold text-sm sm:text-base text-white hover:text-amber-300 transition-colors text-center mb-1 line-clamp-1 max-w-full"
                  aria-label={`Third place winner: ${leaderboard[2].username}`}
                >
                  {leaderboard[2].username}
                </Link>
                <div className="text-xl sm:text-2xl font-bold text-amber-500 mb-2">
                  {leaderboard[2].totalPoints}
                </div>
                <div className="w-full bg-gradient-to-t from-amber-700/30 to-amber-600/30 rounded-t-lg border-2 border-amber-600/50 px-3 py-2 sm:py-3 flex flex-col items-center">
                  <div className="text-xs text-amber-400 font-medium">
                    Bronze
                  </div>
                  <div className="text-2xl sm:text-3xl font-bold text-amber-500 mt-1">
                    3rd
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Current User Rank */}
      {currentUserRank && (
        <Card className="bg-orange-500/10 border-2 border-orange-500/30">
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
          <CardHeader className="border-b-2 border-[#4a6b7d]/60 px-3 sm:px-6">
            <div className="grid grid-cols-12 text-sm font-medium text-slate-400 gap-2 items-center">
              <div className="col-span-1">
                <span className="sr-only">Rank</span>
              </div>
              <div className="col-span-5 sm:col-span-3">Player</div>
              <div className="col-span-3 sm:col-span-2 text-center">Shows</div>
              <div className="col-span-2 text-center hidden sm:block">Avg</div>
              <div className="col-span-2 text-right">Points</div>
              <div className="col-span-1 sm:col-span-2">
                <span className="sr-only">View picks</span>
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-0 overflow-hidden">
            <div className="divide-y divide-[#4a6b7d]/40">
              {leaderboard.map((user) => {
                const isCurrentUser = currentUserId === user.userId
                const isExpanded = expandedUserIds.has(user.userId)

                return (
                  <div
                    key={user.userId}
                    className={`px-3 sm:px-6 py-3 sm:py-4 ${
                      isCurrentUser ? "bg-orange-500/5" : ""
                    }`}
                  >
                    {/* Main row with rank, username, stats */}
                    <div
                      className="grid grid-cols-12 items-center gap-2 cursor-pointer hover:bg-[#4a6b7d]/20 -mx-3 sm:-mx-6 px-3 sm:px-6 py-2 rounded-lg transition-colors"
                      onClick={() => toggleExpanded(user.userId)}
                    >
                      <div className="col-span-1 flex justify-center">
                        {getRankIcon(user.rank)}
                      </div>
                      <div className="col-span-5 sm:col-span-3">
                        <Link
                          href={`/user/${user.username}`}
                          className={`font-medium text-sm sm:text-base hover:underline ${
                            isCurrentUser ? "text-orange-400" : "text-white"
                          }`}
                          onClick={(e) => e.stopPropagation()}
                        >
                          {user.username}
                          {isCurrentUser && (
                            <span className="ml-2 text-xs text-orange-400">
                              (You)
                            </span>
                          )}
                        </Link>
                        <p className="text-xs text-slate-500 sm:hidden">
                          {user.avgPoints} avg
                        </p>
                      </div>
                      <div className="col-span-3 sm:col-span-2 text-center text-slate-400 text-sm sm:text-base">
                        {user.showsPlayed}
                      </div>
                      <div className="col-span-2 text-center text-slate-400 hidden sm:block">
                        {user.avgPoints}
                      </div>
                      <div className="col-span-2 text-right">
                        <span className="text-lg sm:text-xl font-bold text-white">
                          {user.totalPoints}
                        </span>
                      </div>
                      <div className="col-span-1 sm:col-span-2 flex justify-center">
                        <div className="text-slate-400">
                          <ChevronDown
                            className={`h-4 w-4 transition-transform ${
                              isExpanded ? "rotate-180" : ""
                            }`}
                          />
                        </div>
                      </div>
                    </div>

                    {/* Expanded song picks by show */}
                    {user.picksByShow.length > 0 && (
                      <div
                        className={`grid transition-all duration-300 ease-in-out ${
                          isExpanded
                            ? "grid-rows-[1fr] opacity-100 mt-3"
                            : "grid-rows-[0fr] opacity-0"
                        }`}
                      >
                        <div className="overflow-hidden">
                          <div className="space-y-4">
                            {user.picksByShow.map((showPicks, showIdx) => {
                              // Separate picks by type
                              const openerPick = showPicks.picks.find(
                                (p) => p.pickType === "OPENER"
                              )
                              const encorePicks = showPicks.picks.filter(
                                (p) => p.pickType === "ENCORE"
                              )
                              const regularPicks = showPicks.picks.filter(
                                (p) => p.pickType === "REGULAR"
                              )

                              return (
                                <div
                                  key={showIdx}
                                  className="border-2 border-[#4a6b7d]/40 rounded-lg p-3 bg-[#233d4d]/30"
                                >
                                  {/* Show header */}
                                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-3 pb-2 border-b-2 border-[#4a6b7d]/40">
                                    <div className="text-xs text-slate-400">
                                      {new Date(
                                        showPicks.show.showDate
                                      ).toLocaleDateString("en-US", {
                                        month: "short",
                                        day: "numeric",
                                        year: "numeric",
                                        timeZone: "UTC",
                                      })}{" "}
                                      • {showPicks.show.venue}
                                      {showPicks.show.city &&
                                        `, ${showPicks.show.city}`}
                                      {showPicks.show.state &&
                                        `, ${showPicks.show.state}`}
                                    </div>
                                    <div className="text-xs font-semibold text-orange-400">
                                      {showPicks.totalPoints} pts
                                    </div>
                                  </div>

                                  {/* Opener */}
                                  {openerPick && (
                                    <div className="mb-2">
                                      <div className="text-xs font-medium text-slate-500 mb-1">
                                        Opener
                                      </div>
                                      <div
                                        className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs ${
                                          openerPick.pointsEarned > 0
                                            ? "bg-green-500/20 text-green-400 border-2 border-green-500/30"
                                            : "bg-[#4a6b7d]/30 text-slate-400 border-2 border-[#4a6b7d]/40"
                                        }`}
                                      >
                                        {openerPick.pointsEarned > 0 && (
                                          <Check className="h-3 w-3" />
                                        )}
                                        <span>{openerPick.songName}</span>
                                      </div>
                                    </div>
                                  )}

                                  {/* Regular picks */}
                                  {regularPicks.length > 0 && (
                                    <div className="mb-2">
                                      <div className="text-xs font-medium text-slate-500 mb-1">
                                        Regular Picks
                                      </div>
                                      <div className="flex flex-wrap gap-1.5">
                                        {regularPicks.map((pick, idx) => (
                                          <div
                                            key={idx}
                                            className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs ${
                                              pick.pointsEarned > 0
                                                ? "bg-green-500/20 text-green-400 border-2 border-green-500/30"
                                                : "bg-[#4a6b7d]/30 text-slate-400 border-2 border-[#4a6b7d]/40"
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

                                  {/* Encore */}
                                  {encorePicks.length > 0 && (
                                    <div>
                                      <div className="text-xs font-medium text-slate-500 mb-1">
                                        Encore
                                      </div>
                                      <div className="flex flex-wrap gap-1.5">
                                        {encorePicks.map((pick, idx) => (
                                          <div
                                            key={idx}
                                            className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs ${
                                              pick.pointsEarned > 0
                                                ? "bg-green-500/20 text-green-400 border-2 border-green-500/30"
                                                : "bg-[#4a6b7d]/30 text-slate-400 border-2 border-[#4a6b7d]/40"
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

      {/* Stats Legend and History Link */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 text-sm text-slate-500">
        <span className="flex items-center">
          <TrendingUp className="h-4 w-4 mr-1" />
          Points are cumulative per tour
        </span>
        {hasPastTours && (
          <Link
            href="/leaderboard/history"
            className="flex items-center gap-2 text-orange-400 hover:text-orange-300 transition-colors"
          >
            <Trophy className="h-4 w-4" />
            View Past Tour Winners
          </Link>
        )}
      </div>
    </div>
  )
}
