"use client"

import { useMemo, useState } from "react"
import Link from "next/link"
import {
  Trophy,
  Medal,
  User,
  Users,
  TrendingUp,
  Calendar,
  MapPin,
  Check,
  ChevronDown,
  Radio,
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

interface CurrentShowInfo {
  showDate: Date
  venue: string
  city: string | null
  state: string | null
  isComplete: boolean
}

interface LeaderboardClientProps {
  tourLeaderboard: LeaderboardEntry[]
  showLeaderboard: LeaderboardEntry[]
  currentShow: CurrentShowInfo | null
  nextShow: Show | null
  currentUserId: string | null
  hasPastTours: boolean
}

type View = "show" | "tour"

function getRankIcon(rank: number) {
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

function locationLabel(place: {
  venue: string
  city: string | null
  state: string | null
}) {
  return `${place.venue}${place.city ? `, ${place.city}` : ""}${
    place.state ? `, ${place.state}` : ""
  }`
}

const PODIUM_SPOT_STYLES = {
  2: {
    place: "2nd",
    rankLabel: "Silver",
    rankNum: 2,
    wrapClass: "flex-col items-center flex-1",
    avatarClass:
      "w-16 h-16 sm:w-20 sm:h-20 rounded-full bg-gradient-to-br from-gray-300 to-gray-500 flex items-center justify-center shadow-lg",
    badgeClass:
      "absolute -top-1 -right-1 w-6 h-6 sm:w-7 sm:h-7 rounded-full bg-slate-700 border-2 border-gray-400 flex items-center justify-center",
    badgeTextClass: "text-xs sm:text-sm font-bold text-gray-300",
    nameClass:
      "font-semibold text-sm sm:text-base text-white hover:text-gray-300 transition-colors text-center mb-1 line-clamp-1 max-w-full",
    chipClass:
      "px-2.5 py-1 rounded-full bg-gray-300/10 border border-gray-400/40 text-white font-semibold text-xs sm:text-sm hover:bg-gray-300/20 hover:text-gray-300 transition-colors line-clamp-1 max-w-[9rem]",
    pointsClass: "text-xl sm:text-2xl font-bold text-gray-300 mb-2",
    podiumBarClass:
      "w-full bg-gradient-to-t from-gray-400/30 to-gray-300/30 rounded-t-lg border-2 border-gray-400/50 px-3 py-3 sm:py-4 flex flex-col items-center",
    rankLabelClass: "text-xs text-gray-300 font-medium",
    rankNumClass:
      "text-2xl sm:text-3xl font-bold font-display text-gray-200 mt-1",
    icon: <Medal className="h-8 w-8 sm:h-10 sm:w-10 text-white" />,
  },
  1: {
    place: "1st",
    rankLabel: "Gold",
    rankNum: 1,
    wrapClass: "flex-col items-center flex-1",
    avatarClass:
      "w-20 h-20 sm:w-24 sm:h-24 rounded-full bg-gradient-to-br from-yellow-300 via-yellow-400 to-yellow-600 flex items-center justify-center shadow-2xl shadow-yellow-500/50 animate-pulse",
    badgeClass:
      "absolute -top-1 -right-1 w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-slate-700 border-2 border-yellow-400 flex items-center justify-center",
    badgeTextClass: "text-sm sm:text-base font-bold text-yellow-400",
    nameClass:
      "font-bold text-base sm:text-lg text-yellow-400 hover:text-yellow-300 transition-colors text-center mb-1 line-clamp-1 max-w-full",
    chipClass:
      "px-2.5 py-1 rounded-full bg-yellow-400/10 border border-yellow-400/40 text-yellow-400 font-bold text-sm sm:text-base hover:bg-yellow-400/20 hover:text-yellow-300 transition-colors line-clamp-1 max-w-[9rem]",
    pointsClass: "text-2xl sm:text-3xl font-bold text-yellow-400 mb-2",
    podiumBarClass:
      "w-full bg-gradient-to-t from-yellow-600/30 to-yellow-400/30 rounded-t-lg border-2 border-yellow-400/50 px-3 py-5 sm:py-6 flex flex-col items-center",
    rankLabelClass: "text-xs text-yellow-300 font-medium",
    rankNumClass:
      "text-3xl sm:text-4xl font-bold font-display text-yellow-400 mt-1",
    icon: <Trophy className="h-10 w-10 sm:h-12 sm:w-12 text-yellow-900" />,
  },
  3: {
    place: "3rd",
    rankLabel: "Bronze",
    rankNum: 3,
    wrapClass: "flex-col items-center flex-1",
    avatarClass:
      "w-16 h-16 sm:w-20 sm:h-20 rounded-full bg-gradient-to-br from-amber-600 to-amber-800 flex items-center justify-center shadow-lg",
    badgeClass:
      "absolute -top-1 -right-1 w-6 h-6 sm:w-7 sm:h-7 rounded-full bg-slate-700 border-2 border-amber-600 flex items-center justify-center",
    badgeTextClass: "text-xs sm:text-sm font-bold text-amber-400",
    nameClass:
      "font-semibold text-sm sm:text-base text-white hover:text-amber-300 transition-colors text-center mb-1 line-clamp-1 max-w-full",
    chipClass:
      "px-2.5 py-1 rounded-full bg-amber-600/10 border border-amber-600/40 text-white font-semibold text-xs sm:text-sm hover:bg-amber-600/20 hover:text-amber-300 transition-colors line-clamp-1 max-w-[9rem]",
    pointsClass: "text-xl sm:text-2xl font-bold text-amber-500 mb-2",
    podiumBarClass:
      "w-full bg-gradient-to-t from-amber-700/30 to-amber-600/30 rounded-t-lg border-2 border-amber-600/50 px-3 py-2 sm:py-3 flex flex-col items-center",
    rankLabelClass: "text-xs text-amber-400 font-medium",
    rankNumClass:
      "text-2xl sm:text-3xl font-bold font-display text-amber-500 mt-1",
    icon: <Medal className="h-8 w-8 sm:h-10 sm:w-10 text-amber-200" />,
  },
} as const

function Podium({ entries }: { entries: LeaderboardEntry[] }) {
  // Group entries by their actual competition rank (1, 2, 3) so ties land in
  // the same podium spot instead of being spread across positions 0/1/2.
  const groupedByRank = new Map<number, LeaderboardEntry[]>()
  for (const entry of entries) {
    if (entry.rank > 3) continue
    const group = groupedByRank.get(entry.rank)
    if (group) {
      group.push(entry)
    } else {
      groupedByRank.set(entry.rank, [entry])
    }
  }

  // With all three spots filled, use the classic 2-1-3 podium arrangement.
  // Otherwise (e.g. only 1st and 2nd), fall back to rank order so 1st place
  // is always on the left.
  const spotOrder = groupedByRank.has(3)
    ? ([2, 1, 3] as const)
    : ([1, 2, 3] as const)

  const podiumSpots = spotOrder
    .map((rankNum) => {
      const group = groupedByRank.get(rankNum)
      if (!group || group.length === 0) return null
      return { ...PODIUM_SPOT_STYLES[rankNum], tiedEntries: group }
    })
    .filter((spot): spot is NonNullable<typeof spot> => spot !== null)

  return (
    <Card className="bg-gradient-to-b from-[#233d4d]/80 to-[#1e3340]/80 border-2 border-[#4a6b7d]/60">
      <CardContent className="py-8 px-4">
        <div
          className="flex items-end justify-center gap-4 sm:gap-8 max-w-3xl mx-auto"
          role="region"
          aria-label="Leaderboard podium"
        >
          {podiumSpots.map((spot) => {
            const isTie = spot.tiedEntries.length > 1
            return (
              <div key={spot.place} className={`flex ${spot.wrapClass}`}>
                <div className="mb-3 relative">
                  <div className={spot.avatarClass}>{spot.icon}</div>
                  <div className={spot.badgeClass}>
                    <span className={spot.badgeTextClass}>{spot.rankNum}</span>
                  </div>
                </div>
                {isTie ? (
                  <div className="flex flex-wrap justify-center gap-1.5 mb-1 max-w-[10rem] sm:max-w-[13rem]">
                    {spot.tiedEntries.map((entry) => (
                      <Link
                        key={entry.userId}
                        href={`/user/${entry.username}`}
                        className={spot.chipClass}
                        aria-label={`Tied for ${spot.place} place: ${entry.username}`}
                      >
                        {entry.username}
                      </Link>
                    ))}
                  </div>
                ) : (
                  <Link
                    href={`/user/${spot.tiedEntries[0].username}`}
                    className={spot.nameClass}
                    aria-label={`${spot.place} place: ${spot.tiedEntries[0].username}`}
                  >
                    {spot.tiedEntries[0].username}
                  </Link>
                )}
                <div className={spot.pointsClass}>
                  {spot.tiedEntries[0].totalPoints}
                </div>
                <div className={spot.podiumBarClass}>
                  <div className="flex items-center gap-1.5">
                    <span className={spot.rankLabelClass}>
                      {spot.rankLabel}
                    </span>
                    {isTie && (
                      <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-orange-500/15 border border-orange-400/40 text-orange-300 text-[10px] font-semibold uppercase tracking-wide">
                        <Users className="h-2.5 w-2.5" />
                        Tie
                      </span>
                    )}
                  </div>
                  <div className={spot.rankNumClass}>{spot.place}</div>
                </div>
              </div>
            )
          })}
        </div>
      </CardContent>
    </Card>
  )
}

function ShowPickDetail({ picksByShow }: { picksByShow: ShowPicks[] }) {
  return (
    <div className="space-y-4">
      {picksByShow.map((showPicks, showIdx) => {
        const openerPick = showPicks.picks.find((p) => p.pickType === "OPENER")
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
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-3 pb-2 border-b-2 border-[#4a6b7d]/40">
              <div className="text-xs text-slate-400">
                {new Date(showPicks.show.showDate).toLocaleDateString("en-US", {
                  month: "short",
                  day: "numeric",
                  year: "numeric",
                  timeZone: "UTC",
                })}{" "}
                • {locationLabel(showPicks.show)}
              </div>
              <div className="text-xs font-semibold text-orange-400">
                {showPicks.totalPoints} pts
              </div>
            </div>

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
                  {openerPick.pointsEarned > 0 && <Check className="h-3 w-3" />}
                  <span>{openerPick.songName}</span>
                </div>
              </div>
            )}

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
                      {pick.pointsEarned > 0 && <Check className="h-3 w-3" />}
                      <span>{pick.songName}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

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
                      {pick.pointsEarned > 0 && <Check className="h-3 w-3" />}
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
  )
}

function LeaderboardTable({
  entries,
  currentUserId,
  showsColumn,
  expandedUserIds,
  onToggle,
}: {
  entries: LeaderboardEntry[]
  currentUserId: string | null
  showsColumn: boolean
  expandedUserIds: Set<string>
  onToggle: (userId: string) => void
}) {
  return (
    <Card>
      <CardHeader className="border-b-2 border-[#4a6b7d]/60 px-3 sm:px-6">
        <div className="grid grid-cols-12 text-sm font-medium text-slate-400 gap-2 items-center">
          <div className="col-span-1">
            <span className="sr-only">Rank</span>
          </div>
          {showsColumn ? (
            <>
              <div className="col-span-5 sm:col-span-3">Player</div>
              <div className="col-span-3 sm:col-span-2 text-center">Shows</div>
              <div className="col-span-2 text-center hidden sm:block">Avg</div>
              <div className="col-span-2 text-right">Points</div>
              <div className="col-span-1 sm:col-span-2">
                <span className="sr-only">View picks</span>
              </div>
            </>
          ) : (
            <>
              <div className="col-span-7 sm:col-span-8">Player</div>
              <div className="col-span-3 sm:col-span-2 text-right">Points</div>
              <div className="col-span-1">
                <span className="sr-only">View picks</span>
              </div>
            </>
          )}
        </div>
      </CardHeader>
      <CardContent className="p-0 overflow-hidden">
        <div className="divide-y divide-[#4a6b7d]/40">
          {entries.map((user) => {
            const isCurrentUser = currentUserId === user.userId
            const isExpanded = expandedUserIds.has(user.userId)

            return (
              <div
                key={user.userId}
                className={`px-3 sm:px-6 py-3 sm:py-4 ${
                  isCurrentUser ? "bg-orange-500/5" : ""
                }`}
              >
                <div
                  className="grid grid-cols-12 items-center gap-2 cursor-pointer hover:bg-[#4a6b7d]/20 -mx-3 sm:-mx-6 px-3 sm:px-6 py-2 rounded-lg transition-colors"
                  onClick={() => onToggle(user.userId)}
                >
                  <div className="col-span-1 flex justify-center">
                    {getRankIcon(user.rank)}
                  </div>
                  {showsColumn ? (
                    <>
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
                    </>
                  ) : (
                    <>
                      <div className="col-span-7 sm:col-span-8">
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
                      </div>
                      <div className="col-span-3 sm:col-span-2 text-right">
                        <span className="text-lg sm:text-xl font-bold text-white">
                          {user.totalPoints}
                        </span>
                      </div>
                      <div className="col-span-1 flex justify-center">
                        <div className="text-slate-400">
                          <ChevronDown
                            className={`h-4 w-4 transition-transform ${
                              isExpanded ? "rotate-180" : ""
                            }`}
                          />
                        </div>
                      </div>
                    </>
                  )}
                </div>

                {user.picksByShow.length > 0 && (
                  <div
                    className={`grid transition-all duration-300 ease-in-out ${
                      isExpanded
                        ? "grid-rows-[1fr] opacity-100 mt-3"
                        : "grid-rows-[0fr] opacity-0"
                    }`}
                  >
                    <div className="overflow-hidden">
                      <ShowPickDetail picksByShow={user.picksByShow} />
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </CardContent>
    </Card>
  )
}

function EmptyState({ message }: { message: string }) {
  return (
    <Card>
      <CardContent className="py-12 text-center">
        <Trophy className="h-12 w-12 text-slate-500 mx-auto mb-4" />
        <p className="text-slate-400">{message}</p>
      </CardContent>
    </Card>
  )
}

function YourRankCard({
  entry,
  subtitle,
}: {
  entry: LeaderboardEntry
  subtitle: string
}) {
  return (
    <Card className="bg-orange-500/10 border-2 border-orange-500/30">
      <CardContent className="py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <div className="p-2 bg-orange-500/20 rounded-lg">
              <User className="h-5 w-5 text-orange-500" />
            </div>
            <div>
              <p className="font-semibold text-white">Your Rank</p>
              <p className="text-sm text-slate-400">{subtitle}</p>
            </div>
          </div>
          <div className="text-right">
            <p className="text-3xl font-bold text-orange-500">#{entry.rank}</p>
            <p className="text-sm text-slate-400">{entry.totalPoints} pts</p>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

export default function LeaderboardClient({
  tourLeaderboard,
  showLeaderboard,
  currentShow,
  nextShow,
  currentUserId,
  hasPastTours,
}: LeaderboardClientProps) {
  const isActiveTour = nextShow?.tour?.status === "ACTIVE"
  const [view, setView] = useState<View>(isActiveTour ? "show" : "tour")
  const [expandedShow, setExpandedShow] = useState<Set<string>>(new Set())
  const [expandedTour, setExpandedTour] = useState<Set<string>>(new Set())

  const toggleShow = (userId: string) => {
    setExpandedShow((prev) => {
      const next = new Set(prev)
      if (next.has(userId)) {
        next.delete(userId)
      } else {
        next.add(userId)
      }
      return next
    })
  }

  const toggleTour = (userId: string) => {
    setExpandedTour((prev) => {
      const next = new Set(prev)
      if (next.has(userId)) {
        next.delete(userId)
      } else {
        next.add(userId)
      }
      return next
    })
  }

  const currentUserShowEntry = useMemo(
    () =>
      currentUserId
        ? showLeaderboard.find((u) => u.userId === currentUserId) || null
        : null,
    [showLeaderboard, currentUserId]
  )
  const currentUserTourEntry = useMemo(
    () =>
      currentUserId
        ? tourLeaderboard.find((u) => u.userId === currentUserId) || null
        : null,
    [tourLeaderboard, currentUserId]
  )

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <h1 className="text-3xl font-bold font-display text-white">
          Leaderboard
        </h1>

        {/* View toggle */}
        {isActiveTour && (
          <div className="inline-flex self-start rounded-lg border-2 border-[#4a6b7d]/60 bg-[#1e3340]/60 p-1">
            <button
              type="button"
              onClick={() => setView("show")}
              className={`px-4 py-1.5 rounded-md text-sm font-semibold transition-colors ${
                view === "show"
                  ? "bg-orange-500 text-white shadow"
                  : "text-slate-300 hover:text-white"
              }`}
            >
              This Show
            </button>
            <button
              type="button"
              onClick={() => setView("tour")}
              className={`px-4 py-1.5 rounded-md text-sm font-semibold transition-colors ${
                view === "tour"
                  ? "bg-orange-500 text-white shadow"
                  : "text-slate-300 hover:text-white"
              }`}
            >
              Tour Standings
            </button>
          </div>
        )}
      </div>

      {isActiveTour && view === "show" ? (
        <>
          {/* This Show banner */}
          {currentShow ? (
            <Card
              className={
                currentShow.isComplete
                  ? "bg-[#233d4d]/90 border-2 border-[#4a6b7d]/60"
                  : "bg-gradient-to-r from-orange-500/20 to-red-500/20 border-2 border-orange-500/50"
              }
            >
              <CardContent className="py-4">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                  <div className="flex items-center space-x-4">
                    <div
                      className={
                        currentShow.isComplete
                          ? "p-2 bg-[#4a6b7d]/30 rounded-lg"
                          : "p-2 bg-orange-500/20 rounded-lg"
                      }
                    >
                      <MapPin
                        className={
                          currentShow.isComplete
                            ? "h-5 w-5 text-slate-400"
                            : "h-5 w-5 text-orange-500"
                        }
                      />
                    </div>
                    <div>
                      <p className="font-semibold text-white">
                        {locationLabel(currentShow)}
                      </p>
                      <p className="text-sm text-slate-400">
                        {parseUTCDate(currentShow.showDate, "MMM d, yyyy")}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center space-x-2 text-sm">
                    {currentShow.isComplete ? (
                      <span className="font-semibold text-slate-300">
                        Final Results
                      </span>
                    ) : (
                      <>
                        <Radio className="h-4 w-4 text-orange-400 animate-pulse" />
                        <span className="font-semibold text-orange-400">
                          Live Scoring
                        </span>
                      </>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ) : (
            <EmptyState message="No show has locked yet. Check back after the next show's picks lock!" />
          )}

          {currentShow && showLeaderboard.length >= 3 && (
            <Podium entries={showLeaderboard} />
          )}

          {currentUserShowEntry && (
            <YourRankCard
              entry={currentUserShowEntry}
              subtitle={`${
                currentUserShowEntry.picksByShow[0]?.picks.filter(
                  (p) => p.wasPlayed
                ).length ?? 0
              } of 13 picks correct`}
            />
          )}

          {currentShow &&
            (showLeaderboard.length === 0 ? (
              <EmptyState message="No picks were submitted for this show." />
            ) : (
              <LeaderboardTable
                entries={showLeaderboard}
                currentUserId={currentUserId}
                showsColumn={false}
                expandedUserIds={expandedShow}
                onToggle={toggleShow}
              />
            ))}

          <div className="flex items-center justify-center text-sm text-slate-500">
            <TrendingUp className="h-4 w-4 mr-1" />
            Points shown are for this show only
          </div>
        </>
      ) : (
        <>
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
                            -{" "}
                            {parseUTCDate(nextShow.tour.endDate, "MMM d, yyyy")}
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
                          Next: {locationLabel(nextShow)} •{" "}
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
          {nextShow?.tour?.status === "COMPLETED" &&
            tourLeaderboard.length >= 3 && <Podium entries={tourLeaderboard} />}

          {/* Current User Rank */}
          {currentUserTourEntry && (
            <YourRankCard
              entry={currentUserTourEntry}
              subtitle={`${currentUserTourEntry.showsPlayed} shows played`}
            />
          )}

          {/* Leaderboard Table */}
          {tourLeaderboard.length === 0 ? (
            <EmptyState message="No scores yet for this tour." />
          ) : (
            <LeaderboardTable
              entries={tourLeaderboard}
              currentUserId={currentUserId}
              showsColumn={true}
              expandedUserIds={expandedTour}
              onToggle={toggleTour}
            />
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
        </>
      )}
    </div>
  )
}
