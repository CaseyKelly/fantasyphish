import { prisma } from "@/lib/prisma"
import { format } from "date-fns"
import { User, Calendar, Trophy, Target, TrendingUp } from "lucide-react"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { AchievementBadge } from "@/components/AchievementBadge"
import { notFound } from "next/navigation"

async function getUserProfile(username: string) {
  const now = new Date()

  const user = await prisma.user.findUnique({
    where: { username },
    include: {
      submissions: {
        include: {
          picks: true,
          show: {
            select: {
              lockTime: true,
              isComplete: true,
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
  })

  if (!user) return null

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

  return {
    username: user.username,
    createdAt: user.createdAt,
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
    },
    achievements: user.achievements.map((ua) => ({
      id: ua.id,
      icon: ua.achievement.icon,
      name: ua.achievement.name,
    })),
  }
}

export default async function UserProfilePage({
  params,
}: {
  params: Promise<{ username: string }>
}) {
  const { username } = await params
  const profile = await getUserProfile(username)

  if (!profile) {
    notFound()
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-white">{profile.username}</h1>
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
          </CardContent>
        </Card>
      </div>

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
                />
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
