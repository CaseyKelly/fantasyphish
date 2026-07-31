"use client"

import { useState } from "react"
import { X } from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"
import { SortableTable, Column } from "@/components/admin/SortableTable"
import {
  UsageOverview as UsageOverviewStats,
  UserEngagementRow,
} from "@/lib/admin-usage"

type MetricKey =
  | "totalUsers"
  | "verified"
  | "totalSubmissions"
  | "donutPlayers"
  | "emailOptIn"
  | "pushEnabled"
  | "bannerDismissed"

interface MetricConfig {
  title: string
  filter: (row: UserEngagementRow) => boolean
  columns: Column<UserEngagementRow>[]
  initialSortKey: string
  initialSortDir?: "asc" | "desc"
}

const metricConfig: Record<MetricKey, MetricConfig> = {
  totalUsers: {
    title: "Total Users",
    filter: () => true,
    columns: [
      { key: "username", header: "User", sortable: true },
      { key: "email", header: "Email", sortable: true },
      {
        key: "signupDate",
        header: "Signed Up",
        sortable: true,
        render: (row) => row.signupDate.slice(0, 10),
      },
    ],
    initialSortKey: "signupDate",
  },
  verified: {
    title: "Verified Users",
    filter: (row) => row.emailVerified,
    columns: [
      { key: "username", header: "User", sortable: true },
      { key: "email", header: "Email", sortable: true },
      {
        key: "signupDate",
        header: "Signed Up",
        sortable: true,
        render: (row) => row.signupDate.slice(0, 10),
      },
    ],
    initialSortKey: "signupDate",
  },
  totalSubmissions: {
    title: "Submissions by User",
    filter: () => true,
    columns: [
      { key: "username", header: "User", sortable: true },
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
        render: (row) =>
          row.lastSubmissionDate ? row.lastSubmissionDate.slice(0, 10) : "—",
      },
    ],
    initialSortKey: "submissionCount",
  },
  donutPlayers: {
    title: "Donut Catch Players",
    filter: (row) => row.donutScore !== null,
    columns: [
      { key: "username", header: "User", sortable: true },
      {
        key: "donutScore",
        header: "Best Score",
        sortable: true,
        align: "right",
      },
    ],
    initialSortKey: "donutScore",
  },
  emailOptIn: {
    title: "Email Reminders On",
    filter: (row) => row.emailOptIn,
    columns: [
      { key: "username", header: "User", sortable: true },
      { key: "email", header: "Email", sortable: true },
    ],
    initialSortKey: "username",
    initialSortDir: "asc",
  },
  pushEnabled: {
    title: "Push Notifications On",
    filter: (row) => row.pushCount > 0,
    columns: [
      { key: "username", header: "User", sortable: true },
      {
        key: "pushCount",
        header: "Devices",
        sortable: true,
        align: "right",
      },
    ],
    initialSortKey: "pushCount",
  },
  bannerDismissed: {
    title: "Dismissed Reminder Banner",
    filter: (row) => row.bannerDismissed,
    columns: [
      { key: "username", header: "User", sortable: true },
      { key: "email", header: "Email", sortable: true },
    ],
    initialSortKey: "username",
    initialSortDir: "asc",
  },
}

function StatTile({
  label,
  value,
  onClick,
}: {
  label: string
  value: string
  onClick: () => void
}) {
  return (
    <button onClick={onClick} className="text-left">
      <Card className="transition-colors hover:border-[#c23a3a]/60">
        <CardContent className="space-y-1">
          <p className="text-xs uppercase tracking-wide text-gray-500">
            {label}
          </p>
          <p className="text-2xl font-bold text-white">{value}</p>
        </CardContent>
      </Card>
    </button>
  )
}

interface UsageOverviewProps {
  overview: UsageOverviewStats
  engagementRows: UserEngagementRow[]
}

export function UsageOverview({
  overview,
  engagementRows,
}: UsageOverviewProps) {
  const [selectedMetric, setSelectedMetric] = useState<MetricKey | null>(null)

  const config = selectedMetric ? metricConfig[selectedMetric] : null
  const rows = config ? engagementRows.filter(config.filter) : []

  return (
    <>
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <StatTile
          label="Total Users"
          value={String(overview.totalUsers)}
          onClick={() => setSelectedMetric("totalUsers")}
        />
        <StatTile
          label="Verified"
          value={String(overview.verifiedUsers)}
          onClick={() => setSelectedMetric("verified")}
        />
        <StatTile
          label="Total Submissions"
          value={String(overview.totalSubmissions)}
          onClick={() => setSelectedMetric("totalSubmissions")}
        />
        <StatTile
          label="Donut Players"
          value={`${overview.donutPlayers} (${overview.donutPlayersPct}%)`}
          onClick={() => setSelectedMetric("donutPlayers")}
        />
        <StatTile
          label="Email Reminders On"
          value={`${overview.emailOptInUsers} (${overview.emailOptInPct}%)`}
          onClick={() => setSelectedMetric("emailOptIn")}
        />
        <StatTile
          label="Push Enabled"
          value={`${overview.pushEnabledUsers} (${overview.pushEnabledPct}%)`}
          onClick={() => setSelectedMetric("pushEnabled")}
        />
        <StatTile
          label="Banner Dismissed"
          value={`${overview.bannerDismissedUsers} (${overview.bannerDismissedPct}%)`}
          onClick={() => setSelectedMetric("bannerDismissed")}
        />
      </div>

      {config && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 p-4"
          onClick={() => setSelectedMetric(null)}
        >
          <div
            className="flex max-h-[80vh] w-full max-w-2xl flex-col rounded-lg bg-[#2d4654] shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-[#3d5a6c]/50 p-6">
              <div>
                <h2 className="text-xl font-bold text-white">{config.title}</h2>
                <p className="text-sm text-gray-500">
                  {rows.length} user{rows.length === 1 ? "" : "s"}
                </p>
              </div>
              <button
                onClick={() => setSelectedMetric(null)}
                className="text-gray-400 transition-colors hover:text-white"
              >
                <X className="h-6 w-6" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-6">
              <SortableTable
                columns={config.columns}
                rows={rows}
                rowKey={(row) => row.id}
                initialSortKey={config.initialSortKey}
                initialSortDir={config.initialSortDir ?? "desc"}
                emptyMessage="No users match this metric."
              />
            </div>
          </div>
        </div>
      )}
    </>
  )
}
