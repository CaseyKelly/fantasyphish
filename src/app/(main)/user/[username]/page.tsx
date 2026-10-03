import { prisma } from "@/lib/prisma"
import { format } from "date-fns"
import Link from "next/link"
import {
  User,
  Calendar,
  Trophy,
  Target,
  TrendingUp,
  Star,
  Flame,
  PlaneTakeoff,
  PlaneLanding,
  Music,
} from "lucide-react"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { AchievementBadge } from "@/components/AchievementBadge"
import { NotificationSettings } from "@/components/NotificationSettings"
import { notFound } from "next/navigation"
import { Metadata } from "next"
import { withRetry } from "@/lib/db-retry"
import { auth } from "@/lib/auth"
import { getStreaksForUsers, TEST_VENUE_MARKER } from "@/lib/streaks"
import { computePickBreakdown, type PickTypeStat } from "@/lib/profile-stats"

// How far ahead an unlocked show counts as "tonight" for the keep-your-streak
// prompt on your own profile.
const STREAK_PROMPT_WINDOW_MS = 24 * 60 * 60 * 1000

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

  const [streaks, nextShow] = await Promise.all([
    getStreaksForUsers([user.id], now),
    withRetry(
      () =>
        prisma.show.findFirst({
          where: {
            lockTime: {
              gt: now,
              lte: new Date(now.getTime() + STREAK_PROMPT_WINDOW_MS),
            },
            NOT: { venue: { contains: TEST_VENUE_MARKER } },
          },
          select: { id: true, venue: true },
          orderBy: { lockTime: "asc" },
        }),
      { operationName: "find next show for streak prompt" }
    ),
  ])
  const streak = streaks.get(user.id) ?? { current: 0, best: 0 }
  const streakAtRiskShow =
    streak.current > 0 &&
    nextShow &&
    !user.submissions.some((s) => s.showId === nextShow.id)
      ? nextShow
      : null

  const emailPickReminders = user.emailPickReminders
  const emailVerified = !!user.emailVerified

  // Include submissions that are either scored OR locked (show has started)
  const scoredOrLockedSubmissions = user.submissions.filter(
    (s) => s.isScored || (s.show.lockTime && s.show.lockTime <= now)
  )

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

  const pickBreakdown = computePickBreakdown(scoredOrLockedSubmissions)

  return {
    username: user.username,
    createdAt: user.createdAt,
    emailPickReminders,
    emailVerified,
    stats: {
      totalShows: scoredOrLockedSubmissions.length,
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
      currentStreak: streak.current,
      bestStreak: streak.best,
    },
    streakAtRiskShow,
    pickBreakdown,
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

function PickTypeRow({
  icon,
  iconClassName,
  label,
  points,
  stat,
}: {
  icon: React.ReactNode
  iconClassName: string
  label: string
  points: string
  stat: PickTypeStat
}): React.ReactElement {
  return (
    <div className="flex items-center justify-between">
      <div className="flex items-center space-x-3">
        <div className={`p-2 rounded-lg ${iconClassName}`}>{icon}</div>
        <div>
          <p className="text-sm text-gray-400">
            {label} <span className="text-xs text-gray-500">({points})</span>
          </p>
          <p className="text-2xl font-bold text-white">{stat.hits}</p>
        </div>
      </div>
      <div className="text-right">
        <p className="text-sm text-gray-400">Hit rate</p>
        <p className="text-lg font-semibold text-white">
          {stat.rate}%{" "}
          <span className="text-xs font-normal text-gray-500">
            ({stat.hits}/{stat.attempts})
          </span>
        </p>
      </div>
    </div>
  )
}

function MiniStat({
  label,
  value,
  detail,
}: {
  label: string
  value: string | number
  detail?: string
}): React.ReactElement {
  return (
    <div className="rounded-lg bg-white/5 p-3">
      <p className="text-xs text-gray-400">{label}</p>
      <p className="font-semibold text-white truncate" title={String(value)}>
        {value}
      </p>
      {detail && <p className="text-xs text-gray-500">{detail}</p>}
    </div>
  )
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
                  <p className="text-sm text-gray-400">Show Streak</p>
                  <p className="text-2xl font-bold text-white">
                    {profile.stats.currentStreak}
                  </p>
                </div>
              </div>
              <div className="text-right">
                <p className="text-sm text-gray-400">Best</p>
                <p className="text-lg font-semibold text-white">
                  {profile.stats.bestStreak}
                </p>
              </div>
            </div>

            {isOwnProfile && profile.streakAtRiskShow && (
              <Link
                href={`/pick/${profile.streakAtRiskShow.id}`}
                className="block text-sm text-orange-400 hover:text-orange-300"
              >
                🔥 Pick for {profile.streakAtRiskShow.venue} to keep your{" "}
                {profile.stats.currentStreak}-show streak alive →
              </Link>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Pick Breakdown */}
      {profile.stats.totalShows > 0 && (
        <Card>
          <CardHeader>
            <h2 className="text-xl font-semibold text-white">Pick Breakdown</h2>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid gap-4 md:grid-cols-3">
              <PickTypeRow
                icon={<PlaneTakeoff className="h-5 w-5 text-[#c23a3a]" />}
                iconClassName="bg-[#c23a3a]/20"
                label="Openers"
                points="3 pts"
                stat={profile.pickBreakdown.opener}
              />
              <PickTypeRow
                icon={<PlaneLanding className="h-5 w-5 text-purple-400" />}
                iconClassName="bg-purple-500/20"
                label="Encores"
                points="3 pts"
                stat={profile.pickBreakdown.encore}
              />
              <PickTypeRow
                icon={<Music className="h-5 w-5 text-white" />}
                iconClassName="bg-[#3d5a6c]"
                label="Regular"
                points="1 pt"
                stat={profile.pickBreakdown.regular}
              />
            </div>

            <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
              <MiniStat
                label="Bookend Shows"
                value={profile.pickBreakdown.bookendShows}
                detail="Opener + encore hit"
              />
              <MiniStat
                label="Most Hits in a Show"
                value={profile.pickBreakdown.mostHitsInShow}
                detail="of 13 picks"
              />
              <MiniStat
                label="Unique Songs Picked"
                value={profile.pickBreakdown.uniqueSongsPicked}
              />
              <MiniStat
                label="Go-To Song"
                value={profile.pickBreakdown.favoriteSong?.name ?? "—"}
                detail={
                  profile.pickBreakdown.favoriteSong
                    ? `Picked ${profile.pickBreakdown.favoriteSong.count}×`
                    : undefined
                }
              />
              <MiniStat
                label="Most Reliable Song"
                value={profile.pickBreakdown.mostReliableSong?.name ?? "—"}
                detail={
                  profile.pickBreakdown.mostReliableSong
                    ? `Hit ${profile.pickBreakdown.mostReliableSong.count}×`
                    : undefined
                }
              />
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
