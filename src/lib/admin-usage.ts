import { prisma } from "@/lib/prisma"
import { withRetry } from "@/lib/db-retry"
import { excludeTestShows } from "@/lib/test-filters"

export interface UsageOverview {
  totalUsers: number
  verifiedUsers: number
  emailOptInUsers: number
  emailOptInPct: number
  pushEnabledUsers: number
  pushEnabledPct: number
  bannerDismissedUsers: number
  bannerDismissedPct: number
  donutPlayers: number
  donutPlayersPct: number
  totalSubmissions: number
}

function pctOf(count: number, total: number): number {
  return total === 0 ? 0 : Math.round((count / total) * 100)
}

export async function getUsageOverview(): Promise<UsageOverview> {
  const [
    totalUsers,
    verifiedUsers,
    emailOptInUsers,
    bannerDismissedUsers,
    pushUserGroups,
    donutPlayers,
    totalSubmissions,
  ] = await withRetry(
    () =>
      Promise.all([
        prisma.user.count(),
        prisma.user.count({ where: { emailVerified: { not: null } } }),
        prisma.user.count({ where: { emailPickReminders: true } }),
        prisma.user.count({ where: { dismissedRemindersBanner: true } }),
        prisma.pushSubscription.groupBy({ by: ["userId"] }),
        prisma.easterEggScore.count(),
        prisma.submission.count({ where: { show: excludeTestShows } }),
      ]),
    { operationName: "get usage overview" }
  )

  const pushEnabledUsers = pushUserGroups.length

  return {
    totalUsers,
    verifiedUsers,
    emailOptInUsers,
    emailOptInPct: pctOf(emailOptInUsers, totalUsers),
    pushEnabledUsers,
    pushEnabledPct: pctOf(pushEnabledUsers, totalUsers),
    bannerDismissedUsers,
    bannerDismissedPct: pctOf(bannerDismissedUsers, totalUsers),
    donutPlayers,
    donutPlayersPct: pctOf(donutPlayers, totalUsers),
    totalSubmissions,
  }
}

export interface UserEngagementRow {
  id: string
  username: string
  email: string
  signupDate: string
  emailVerified: boolean
  isAdmin: boolean
  emailOptIn: boolean
  bannerDismissed: boolean
  pushCount: number
  submissionCount: number
  lastSubmissionDate: string | null
  donutScore: number | null
  achievementCount: number
}

export async function getUserEngagementRows(): Promise<UserEngagementRow[]> {
  const [users, lastSubmissions, donutScores] = await withRetry(
    () =>
      Promise.all([
        prisma.user.findMany({
          select: {
            id: true,
            username: true,
            email: true,
            createdAt: true,
            emailVerified: true,
            isAdmin: true,
            emailPickReminders: true,
            dismissedRemindersBanner: true,
            _count: {
              select: {
                submissions: { where: { show: excludeTestShows } },
                achievements: true,
                pushSubscriptions: true,
              },
            },
          },
          orderBy: { createdAt: "desc" },
        }),
        prisma.submission.groupBy({
          by: ["userId"],
          where: { show: excludeTestShows },
          _max: { createdAt: true },
        }),
        prisma.easterEggScore.findMany({
          select: { userId: true, score: true },
        }),
      ]),
    { operationName: "get user engagement rows" }
  )

  const lastSubmissionMap = new Map(
    lastSubmissions.map((s) => [s.userId, s._max.createdAt])
  )
  const donutScoreMap = new Map(donutScores.map((d) => [d.userId, d.score]))

  return users.map((user) => ({
    id: user.id,
    username: user.username,
    email: user.email,
    signupDate: user.createdAt.toISOString(),
    emailVerified: !!user.emailVerified,
    isAdmin: user.isAdmin,
    emailOptIn: user.emailPickReminders,
    bannerDismissed: user.dismissedRemindersBanner,
    pushCount: user._count.pushSubscriptions,
    submissionCount: user._count.submissions,
    lastSubmissionDate: lastSubmissionMap.get(user.id)?.toISOString() ?? null,
    donutScore: donutScoreMap.get(user.id) ?? null,
    achievementCount: user._count.achievements,
  }))
}

export interface ShowParticipationRow {
  id: string
  showDate: string
  venue: string
  tourName: string | null
  isComplete: boolean
  submissionCount: number
  participationPct: number
}

export async function getShowParticipation(): Promise<ShowParticipationRow[]> {
  const [shows, totalUsers] = await withRetry(
    () =>
      Promise.all([
        prisma.show.findMany({
          where: excludeTestShows,
          orderBy: { showDate: "desc" },
          take: 25,
          select: {
            id: true,
            showDate: true,
            venue: true,
            isComplete: true,
            tour: { select: { name: true } },
            _count: { select: { submissions: true } },
          },
        }),
        prisma.user.count(),
      ]),
    { operationName: "get show participation" }
  )

  return shows.map((show) => ({
    id: show.id,
    showDate: show.showDate.toISOString(),
    venue: show.venue,
    tourName: show.tour?.name ?? null,
    isComplete: show.isComplete,
    submissionCount: show._count.submissions,
    participationPct: pctOf(show._count.submissions, totalUsers),
  }))
}

export interface AchievementDistributionRow {
  id: string
  slug: string
  name: string
  category: string
  icon: string
  earnedCount: number
}

export async function getAchievementDistribution(): Promise<
  AchievementDistributionRow[]
> {
  const [achievements, grouped] = await withRetry(
    () =>
      Promise.all([
        prisma.achievement.findMany({
          select: {
            id: true,
            slug: true,
            name: true,
            category: true,
            icon: true,
          },
        }),
        prisma.userAchievement.groupBy({
          by: ["achievementId"],
          _count: { achievementId: true },
        }),
      ]),
    { operationName: "get achievement distribution" }
  )

  const countMap = new Map(
    grouped.map((g) => [g.achievementId, g._count.achievementId])
  )

  return achievements
    .map((a) => ({
      id: a.id,
      slug: a.slug,
      name: a.name,
      category: a.category,
      icon: a.icon,
      earnedCount: countMap.get(a.id) ?? 0,
    }))
    .sort((a, b) => a.earnedCount - b.earnedCount)
}

export interface DonutLeaderboardRow {
  userId: string
  username: string
  score: number
  achievedAt: string
}

export async function getDonutLeaderboard(): Promise<DonutLeaderboardRow[]> {
  const scores = await withRetry(
    () =>
      prisma.easterEggScore.findMany({
        orderBy: { score: "desc" },
        take: 25,
        select: {
          userId: true,
          score: true,
          updatedAt: true,
          user: { select: { username: true } },
        },
      }),
    { operationName: "get donut leaderboard" }
  )

  return scores.map((s) => ({
    userId: s.userId,
    username: s.user.username,
    score: s.score,
    achievedAt: s.updatedAt.toISOString(),
  }))
}
