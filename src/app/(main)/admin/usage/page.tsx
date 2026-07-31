import { auth } from "@/lib/auth"
import { redirect, notFound } from "next/navigation"
import { Metadata } from "next"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { SortableTable, Column } from "@/components/admin/SortableTable"
import {
  getUsageOverview,
  getUserEngagementRows,
  getShowParticipation,
  getAchievementDistribution,
  getDonutLeaderboard,
  UserEngagementRow,
  ShowParticipationRow,
  AchievementDistributionRow,
  DonutLeaderboardRow,
} from "@/lib/admin-usage"

export const metadata: Metadata = {
  title: "Feature Usage",
  robots: {
    index: false,
    follow: false,
  },
}

function formatDate(iso: string | null): string {
  return iso ? iso.slice(0, 10) : "—"
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

const engagementColumns: Column<UserEngagementRow>[] = [
  { key: "username", header: "User", sortable: true },
  { key: "email", header: "Email", sortable: true },
  {
    key: "signupDate",
    header: "Signed Up",
    sortable: true,
    render: (row) => formatDate(row.signupDate),
  },
  {
    key: "emailVerified",
    header: "Verified",
    sortable: true,
    align: "center",
    render: (row) => (row.emailVerified ? "✓" : "—"),
  },
  {
    key: "submissionCount",
    header: "Submissions",
    sortable: true,
    align: "right",
  },
  {
    key: "lastSubmissionDate",
    header: "Last Submission",
    sortable: true,
    render: (row) => formatDate(row.lastSubmissionDate),
  },
  {
    key: "emailOptIn",
    header: "Email Reminders",
    sortable: true,
    align: "center",
    render: (row) => (row.emailOptIn ? "✓" : "—"),
  },
  {
    key: "pushCount",
    header: "Push Devices",
    sortable: true,
    align: "right",
  },
  {
    key: "bannerDismissed",
    header: "Banner Dismissed",
    sortable: true,
    align: "center",
    render: (row) => (row.bannerDismissed ? "✓" : "—"),
  },
  {
    key: "donutScore",
    header: "Donut Best",
    sortable: true,
    align: "right",
    render: (row) => (row.donutScore === null ? "—" : row.donutScore),
  },
  {
    key: "achievementCount",
    header: "Achievements",
    sortable: true,
    align: "right",
  },
  {
    key: "isAdmin",
    header: "Admin",
    sortable: true,
    align: "center",
    render: (row) => (row.isAdmin ? "✓" : "—"),
  },
]

const showColumns: Column<ShowParticipationRow>[] = [
  {
    key: "showDate",
    header: "Show Date",
    sortable: true,
    render: (row) => formatDate(row.showDate),
  },
  { key: "venue", header: "Venue", sortable: true },
  {
    key: "tourName",
    header: "Tour",
    sortable: true,
    render: (row) => row.tourName ?? "—",
  },
  {
    key: "submissionCount",
    header: "Submissions",
    sortable: true,
    align: "right",
  },
  {
    key: "participationPct",
    header: "Participation",
    sortable: true,
    align: "right",
    render: (row) => `${row.participationPct}%`,
  },
  {
    key: "isComplete",
    header: "Complete",
    sortable: true,
    align: "center",
    render: (row) => (row.isComplete ? "✓" : "—"),
  },
]

const achievementColumns: Column<AchievementDistributionRow>[] = [
  {
    key: "icon",
    header: "",
    align: "center",
    render: (row) => row.icon,
  },
  { key: "name", header: "Achievement", sortable: true },
  { key: "category", header: "Category", sortable: true },
  {
    key: "earnedCount",
    header: "Users Earned",
    sortable: true,
    align: "right",
  },
]

const donutColumns: Column<DonutLeaderboardRow>[] = [
  { key: "username", header: "User", sortable: true },
  { key: "score", header: "Score", sortable: true, align: "right" },
  {
    key: "achievedAt",
    header: "Date",
    sortable: true,
    render: (row) => formatDate(row.achievedAt),
  },
]

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

      <Card>
        <CardHeader>
          <h2 className="text-lg font-semibold text-white">User Engagement</h2>
          <p className="text-sm text-gray-500">
            One row per user. Click a column header to sort.
          </p>
        </CardHeader>
        <CardContent>
          <SortableTable
            columns={engagementColumns}
            rows={engagementRows}
            rowKey={(row) => row.id}
            initialSortKey="signupDate"
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <h2 className="text-lg font-semibold text-white">
            Show Participation
          </h2>
          <p className="text-sm text-gray-500">
            Most recent 25 shows. Participation is submissions ÷ current total
            users, so older shows will read low relative to today&apos;s
            userbase.
          </p>
        </CardHeader>
        <CardContent>
          <SortableTable
            columns={showColumns}
            rows={showRows}
            rowKey={(row) => row.id}
            initialSortKey="showDate"
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <h2 className="text-lg font-semibold text-white">
            Achievement Distribution
          </h2>
          <p className="text-sm text-gray-500">Sorted rarest first.</p>
        </CardHeader>
        <CardContent>
          <SortableTable
            columns={achievementColumns}
            rows={achievementRows}
            rowKey={(row) => row.id}
            initialSortKey="earnedCount"
            initialSortDir="asc"
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <h2 className="text-lg font-semibold text-white">
            Donut Catch Leaderboard
          </h2>
          <p className="text-sm text-gray-500">Top 25 personal bests.</p>
        </CardHeader>
        <CardContent>
          <SortableTable
            columns={donutColumns}
            rows={donutRows}
            rowKey={(row) => row.userId}
            initialSortKey="score"
          />
        </CardContent>
      </Card>
    </div>
  )
}
