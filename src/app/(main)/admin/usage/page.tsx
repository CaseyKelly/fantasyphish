import { auth } from "@/lib/auth"
import { redirect, notFound } from "next/navigation"
import { Metadata } from "next"
import { Card, CardContent } from "@/components/ui/card"
import { UsageTables } from "./UsageTables"
import {
  getUsageOverview,
  getUserEngagementRows,
  getShowParticipation,
  getAchievementDistribution,
  getDonutLeaderboard,
} from "@/lib/admin-usage"

export const metadata: Metadata = {
  title: "Feature Usage",
  robots: {
    index: false,
    follow: false,
  },
}

function StatTile({ label, value }: { label: string; value: string }) {
  return (
    <Card>
      <CardContent className="space-y-1">
        <p className="text-xs uppercase tracking-wide text-gray-500">{label}</p>
        <p className="text-2xl font-bold text-white">{value}</p>
      </CardContent>
    </Card>
  )
}

export default async function AdminUsagePage() {
  const session = await auth()
  if (!session?.user?.id) {
    redirect("/login")
  }

  const isAdmin = session.impersonating?.originalIsAdmin ?? session.user.isAdmin
  if (!isAdmin) {
    notFound()
  }

  const [overview, engagementRows, showRows, achievementRows, donutRows] =
    await Promise.all([
      getUsageOverview(),
      getUserEngagementRows(),
      getShowParticipation(),
      getAchievementDistribution(),
      getDonutLeaderboard(),
    ])

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold font-display text-white">
          Feature Usage
        </h1>
        <p className="mt-1 text-gray-400">
          Internal view of who&apos;s using what across the app.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <StatTile label="Total Users" value={String(overview.totalUsers)} />
        <StatTile label="Verified" value={String(overview.verifiedUsers)} />
        <StatTile
          label="Total Submissions"
          value={String(overview.totalSubmissions)}
        />
        <StatTile
          label="Donut Players"
          value={`${overview.donutPlayers} (${overview.donutPlayersPct}%)`}
        />
        <StatTile
          label="Email Reminders On"
          value={`${overview.emailOptInUsers} (${overview.emailOptInPct}%)`}
        />
        <StatTile
          label="Push Enabled"
          value={`${overview.pushEnabledUsers} (${overview.pushEnabledPct}%)`}
        />
        <StatTile
          label="Banner Dismissed"
          value={`${overview.bannerDismissedUsers} (${overview.bannerDismissedPct}%)`}
        />
      </div>

      <UsageTables
        engagementRows={engagementRows}
        showRows={showRows}
        achievementRows={achievementRows}
        donutRows={donutRows}
      />
    </div>
  )
}
