import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { format } from "date-fns"
import { User, Mail, Calendar, Trophy, Target, TrendingUp } from "lucide-react"
import { Card, CardContent, CardHeader } from "@/components/ui/card"

async function getUserProfile(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: {
      submissions: {
        include: {
          picks: true,
        },
      },
    },
  })

  if (!user) return null

  const scoredSubmissions = user.submissions.filter((s) => s.isScored)
  const totalPoints = scoredSubmissions.reduce(
    (sum, s) => sum + (s.totalPoints || 0),
    0
  )
  const totalPicks = user.submissions.length * 13
  const correctPicks = user.submissions.reduce(
    (sum, sub) => sum + sub.picks.filter((p) => p.wasPlayed).length,
    0
  )

  return {
    username: user.username,
    email: user.email,
    emailVerified: user.emailVerified,
    createdAt: user.createdAt,
    stats: {
      totalShows: user.submissions.length,
      scoredShows: scoredSubmissions.length,
      totalPoints,
      avgPoints:
        scoredSubmissions.length > 0
          ? Math.round((totalPoints / scoredSubmissions.length) * 10) / 10
          : 0,
      accuracy:
        totalPicks > 0 ? Math.round((correctPicks / totalPicks) * 100) : 0,
      correctPicks,
      totalPicks,
    },
  }
}

export default async function ProfilePage() {
  const session = await auth()
  if (!session?.user?.id) return null

  const profile = await getUserProfile(session.user.id)
  if (!profile) return null

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-white">Profile</h1>
        <p className="text-slate-400 mt-1">
          Your account information and stats
        </p>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        {/* Account Info */}
        <Card>
          <CardHeader>
            <h2 className="text-xl font-semibold text-white">
              Account Details
            </h2>
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
                <Mail className="h-5 w-5 text-white" />
              </div>
              <div>
                <p className="text-sm text-gray-400">Email</p>
                <p className="font-medium text-white">{profile.email}</p>
                {profile.emailVerified && (
                  <p className="text-xs text-green-400 mt-1">✓ Verified</p>
                )}
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
            <h2 className="text-xl font-semibold text-white">Your Stats</h2>
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
    </div>
  )
}
