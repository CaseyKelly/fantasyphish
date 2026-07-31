import { auth } from "@/lib/auth"
import { redirect, notFound } from "next/navigation"
import { Metadata } from "next"
import { UsageOverview } from "./UsageOverview"
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

      <UsageOverview overview={overview} engagementRows={engagementRows} />

      <UsageTables
        engagementRows={engagementRows}
        showRows={showRows}
        achievementRows={achievementRows}
        donutRows={donutRows}
      />
    </div>
  )
}
