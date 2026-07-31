import { auth } from "@/lib/auth"
import { redirect, notFound } from "next/navigation"
import { Metadata } from "next"
import Link from "next/link"
import { ArrowLeft } from "lucide-react"
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
        <Link
          href="/admin"
          className="inline-flex items-center gap-1 text-sm text-gray-400 hover:text-white"
        >
          <ArrowLeft className="h-4 w-4" />
          Admin
        </Link>
        <h1 className="mt-2 text-3xl font-bold font-display text-white">
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
