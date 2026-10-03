import { prisma } from "@/lib/prisma"
import { format } from "date-fns"
import {
  User,
  Calendar,
  Trophy,
  Target,
  TrendingUp,
  Star,
  Flame,
} from "lucide-react"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { AchievementBadge } from "@/components/AchievementBadge"
import { NotificationSettings } from "@/components/NotificationSettings"
import { notFound } from "next/navigation"
import { Metadata } from "next"
import { withRetry } from "@/lib/db-retry"
import { auth } from "@/lib/auth"
import { excludeTestShows } from "@/lib/test-filters"
import { POINTS } from "@/lib/scoring"
import { computePickTypeStats, computeShowStreaks } from "@/lib/profile-stats"

const PICK_TYPE_ROWS = [
  { type: "OPENER", label: "Opener", points: POINTS.OPENER },
  { type: "ENCORE", label: "Encore", points: POINTS.ENCORE },
  { type: "REGULAR", label: "Regular", points: POINTS.REGULAR },
] as const

interface UserPageProps {
  params: Promise<{ username: string }>
}

export async function generateMetadata({
  params,
}: UserPageProps): Promise<Metadata> {
  const { username } = await params

  const user = await withRetry(
    () =>
      prisma.user.findUnique({
        where: { username },
        select: { username: true },
      }),
    { operationName: "find user for metadata" }
  )

  if (!user) {
    return {
      title: "User Not Found",
    }
  }

  return {
    title: `${username}'s Profile`,
    description: `View ${username}'s FantasyPhish profile, achievements, and game stats.`,
    openGraph: {
      title: `${username}'s Profile | FantasyPhish`,
      description: `View ${username}'s FantasyPhish profile, achievements, and game stats.`,
    },
    alternates: {
      canonical: `/user/${username}`,
    },
  }
}

async function getUserProfile(username: string) {
  const now = new Date()

  const user = await withRetry(
    () =>
      prisma.user.findUnique({
        where: { username },
        include: {
          submissions: {
            include: {
              picks: {
                include: {
                  song: true,
                },
              },
              show: {
                select: {
                  id: true,
                  lockTime: true,
                  isComplete: true,
                  venue: true,
                  showDate: true,
                },
              },
            },
          },
          achievements: {
            include: {
              achievement: true,
            },
            orderBy: {
              earnedAt: "desc",
            },
          },
        },
      }),
    { operationName: "find user profile" }
  )

  if (!user) return null

  // Every show that has locked, oldest first, for participation streaks
  const lockedShows = await withRetry(
    () =>
      prisma.show.findMany({
        where: { lockTime: { lte: now }, ...excludeTestShows },
        select: { id: true },
        orderBy: { showDate: "asc" },
      }),
    { operationName: "find locked shows for streaks" }
  )

  const emailPickReminders = user.emailPickReminders
  const emailVerified = !!user.emailVerified

  // Include submissions that are either scored OR locked (show has started)
  const scoredOrLockedSubmissions = user.submissions.filter(
    (s) => s.isScored || (s.show.lockTime && s.show.lockTime <= now)
  )

  const scoredSubmissions = user.submissions.filter((s) => s.isScored)
  const totalPoints = scoredOrLockedSubmissions.reduce(
    (sum, s) => sum + (s.totalPoints || 0),
    0
  )
  const totalPicks = scoredOrLockedSubmissions.length * 13
  const correctPicks = scoredOrLockedSubmissions.reduce(
    (sum, sub) => sum + sub.picks.filter((p) => p.wasPlayed).length,
    0
  )

  // Find best show (highest points)
  const bestShow =
    scoredOrLockedSubmissions.length > 0
      ? scoredOrLockedSubmissions.reduce((best, current) => {
          return (current.totalPoints || 0) > (best.totalPoints || 0)
            ? current
            : best
        })
      : null

  const streaks = computeShowStreaks(
    lockedShows.map((s) => s.id),
    new Set(scoredOrLockedSubmissions.map((s) => s.show.id))
  )

  const pickTypeStats = computePickTypeStats(
    scoredOrLockedSubmissions.flatMap((s) => s.picks)
  )

  return {
    username: user.username,
    createdAt: user.createdAt,
    emailPickReminders,
    emailVerified,
    stats: {
      totalShows: scoredOrLockedSubmissions.length,
      scoredShows: scoredSubmissions.length,
      totalPoints,
      avgPoints:
        scoredOrLockedSubmissions.length > 0
          ? Math.round((totalPoints / scoredOrLockedSubmissions.length) * 10) /
            10
          : 0,
      accuracy:
        totalPicks > 0 ? Math.round((correctPicks / totalPicks) * 100) : 0,
      correctPicks,
      totalPicks,
      currentStreak: streaks.current,
      longestStreak: streaks.longest,
    },
    pickTypeStats,
    bestShow: bestShow
      ? {
          points: bestShow.totalPoints || 0,
          venue: bestShow.show.venue,
          date: bestShow.show.showDate,
          picks: bestShow.picks.map((p) => ({
            songName: p.song.name,
            pickType: p.pickType,
            wasPlayed: p.wasPlayed,
            pointsEarned: p.pointsEarned || 0,
          })),
        }
      : null,
    achievements: user.achievements.map((ua) => ({
      id: ua.id,
      icon: ua.achievement.icon,
      name: ua.achievement.name,
      // Exclude description for founding-member achievement
      description:
        ua.achievement.slug === "founding-member"
          ? undefined
          : ua.achievement.description,
    })),
  }
}

export default async function UserProfilePage({ params }: UserPageProps) {
  const { username } = await params
  const [profile, session] = await Promise.all([
    getUserProfile(username),
    auth(),
  ])

  if (!profile) {
    notFound()
  }

  const isOwnProfile = session?.user?.username === username

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold font-display text-white">
          {profile.username}
        </h1>
        <p className="text-slate-400 mt-1">Player stats and achievements</p>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        {/* Account Info */}
        <Card>
          <CardHeader>
            <h2 className="text-xl font-semibold text-white">Player Info</h2>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center space-x-3">
              <div className="p-2 bg-[#3d5a6c] rounded-lg">
                <User className="h-5 w-5 text-white" />
              </div>
              <div>
                <p className="text-sm text-gray-400">Username</p>
                <p className="font-medium text-white">{profile.username}</p>
              </div>
            </div>

            {profile.bestShow && (
              <div className="flex items-center space-x-3">
                <div className="p-2 bg-[#c23a3a]/20 rounded-lg">
                  <Star className="h-5 w-5 text-[#c23a3a]" />
                </div>
                <div>
                  <p className="text-sm text-gray-400">Best Show Score</p>
                  <p className="font-medium text-white">
                    {profile.bestShow.points} points
                  </p>
                  <p className="text-xs text-gray-500">
                    {profile.bestShow.venue} •{" "}
                    {format(new Date(profile.bestShow.date), "MMM d, yyyy")}
                  </p>
                </div>
              </div>
            )}

            <div className="flex items-center space-x-3">
              <div className="p-2 bg-[#3d5a6c] rounded-lg">
                <Calendar className="h-5 w-5 text-white" />
              </div>
              <div>
                <p className="text-sm text-gray-400">Member Since</p>
                <p className="font-medium text-white">
                  {format(new Date(profile.createdAt), "MMMM d, yyyy")}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Stats Overview */}
        <Card>
          <CardHeader>
            <h2 className="text-xl font-semibold text-white">Stats</h2>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <div className="p-2 bg-[#c23a3a]/20 rounded-lg">
                  <Trophy className="h-5 w-5 text-[#c23a3a]" />
                </div>
                <div>
                  <p className="text-sm text-gray-400">Total Points</p>
                  <p className="text-2xl font-bold text-white">
                    {profile.stats.totalPoints}
                  </p>
                </div>
              </div>
              <div className="text-right">
                <p className="text-sm text-gray-400">Avg per show</p>
                <p className="text-lg font-semibold text-[#c23a3a]">
                  {profile.stats.avgPoints}
                </p>
              </div>
            </div>

            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <div className="p-2 bg-[#3d5a6c] rounded-lg">
                  <Target className="h-5 w-5 text-white" />
                </div>
                <div>
                  <p className="text-sm text-gray-400">Shows Played</p>
                  <p className="text-2xl font-bold text-white">
                    {profile.stats.totalShows}
                  </p>
                </div>
              </div>
              <div className="text-right">
                <p className="text-sm text-gray-400">Scored</p>
                <p className="text-lg font-semibold text-white">
                  {profile.stats.scoredShows}
                </p>
              </div>
            </div>

            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <div className="p-2 bg-green-500/20 rounded-lg">
                  <TrendingUp className="h-5 w-5 text-green-500" />
                </div>
                <div>
                  <p className="text-sm text-gray-400">Accuracy</p>
                  <p className="text-2xl font-bold text-white">
                    {profile.stats.accuracy}%
                  </p>
                </div>
              </div>
              <div className="text-right">
                <p className="text-sm text-gray-400">Picks</p>
                <p className="text-lg font-semibold text-white">
                  {profile.stats.correctPicks}/{profile.stats.totalPicks}
                </p>
              </div>
            </div>

            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <div className="p-2 bg-orange-500/20 rounded-lg">
                  <Flame className="h-5 w-5 text-orange-500" />
                </div>
                <div>
                  <p className="text-sm text-gray-400">Current Streak</p>
                  <p className="text-2xl font-bold text-white">
                    {profile.stats.currentStreak}{" "}
                    <span className="text-base font-medium text-gray-400">
                      {profile.stats.currentStreak === 1 ? "show" : "shows"}
                    </span>
                  </p>
                </div>
              </div>
              <div className="text-right">
                <p className="text-sm text-gray-400">Longest</p>
                <p className="text-lg font-semibold text-white">
                  {profile.stats.longestStreak}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Pick Breakdown */}
      {profile.stats.totalShows > 0 && (
        <Card>
          <CardHeader>
            <h2 className="text-xl font-semibold text-white">Pick Breakdown</h2>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-3 gap-4">
              {PICK_TYPE_ROWS.map(({ type, label, points }) => {
                const { hits, scored } = profile.pickTypeStats[type]
                return (
                  <div
                    key={type}
                    className="rounded-lg bg-white/5 p-4 text-center"
                  >
                    <p className="text-sm text-gray-400">{label}</p>
                    <p className="text-2xl font-bold text-white">
                      {hits}
                      <span className="text-base font-medium text-gray-400">
                        /{scored}
                      </span>
                    </p>
                    <p className="text-sm font-semibold text-[#c23a3a]">
                      {scored > 0 ? Math.round((hits / scored) * 100) : 0}%
                    </p>
                    <p className="mt-1 text-xs text-gray-500">
                      {points} {points === 1 ? "pt" : "pts"} each
                    </p>
                  </div>
                )
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Achievements Section */}
      {profile.achievements.length > 0 && (
        <Card>
          <CardHeader>
            <h2 className="text-xl font-semibold text-white">Achievements</h2>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
              {profile.achievements.map((achievement) => (
                <AchievementBadge
                  key={achievement.id}
                  icon={achievement.icon}
                  name={achievement.name}
                  description={achievement.description}
                />
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Notification Preferences */}
      {isOwnProfile && (
        <NotificationSettings
          initialEmailEnabled={profile.emailPickReminders}
          emailVerified={profile.emailVerified}
        />
      )}
    </div>
  )
}
