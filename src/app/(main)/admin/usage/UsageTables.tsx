"use client"

import { ReactNode, useState } from "react"
import { ChevronDown, ChevronUp } from "lucide-react"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { SortableTable, Column } from "@/components/admin/SortableTable"
import {
  UserEngagementRow,
  ShowParticipationRow,
  AchievementDistributionRow,
  DonutLeaderboardRow,
} from "@/lib/admin-usage"

function formatDate(iso: string | null): string {
  return iso ? iso.slice(0, 10) : "—"
}

function CollapsibleCard({
  title,
  description,
  defaultOpen = true,
  children,
}: {
  title: string
  description?: string
  defaultOpen?: boolean
  children: ReactNode
}) {
  const [open, setOpen] = useState(defaultOpen)

  const toggle = () => setOpen((o) => !o)

  return (
    <Card>
      <CardHeader
        onClick={toggle}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault()
            toggle()
          }
        }}
        role="button"
        tabIndex={0}
        aria-expanded={open}
        className="flex cursor-pointer items-center justify-between gap-4 select-none"
      >
        <div>
          <h2 className="text-lg font-semibold text-white">{title}</h2>
          {description && (
            <p className="text-sm text-gray-500">{description}</p>
          )}
        </div>
        {open ? (
          <ChevronUp className="h-5 w-5 flex-shrink-0 text-gray-400" />
        ) : (
          <ChevronDown className="h-5 w-5 flex-shrink-0 text-gray-400" />
        )}
      </CardHeader>
      {open && <CardContent>{children}</CardContent>}
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

interface UsageTablesProps {
  engagementRows: UserEngagementRow[]
  showRows: ShowParticipationRow[]
  achievementRows: AchievementDistributionRow[]
  donutRows: DonutLeaderboardRow[]
}

export function UsageTables({
  engagementRows,
  showRows,
  achievementRows,
  donutRows,
}: UsageTablesProps) {
  return (
    <>
      <CollapsibleCard
        title="User Engagement"
        description="One row per user. Click a column header to sort."
      >
        <SortableTable
          columns={engagementColumns}
          rows={engagementRows}
          rowKey={(row) => row.id}
          initialSortKey="signupDate"
        />
      </CollapsibleCard>

      <CollapsibleCard
        title="Show Participation"
        description="Most recent 25 shows. Participation is submissions ÷ current total users, so older shows will read low relative to today's userbase."
      >
        <SortableTable
          columns={showColumns}
          rows={showRows}
          rowKey={(row) => row.id}
          initialSortKey="showDate"
        />
      </CollapsibleCard>

      <CollapsibleCard
        title="Achievement Distribution"
        description="Sorted rarest first."
      >
        <SortableTable
          columns={achievementColumns}
          rows={achievementRows}
          rowKey={(row) => row.id}
          initialSortKey="earnedCount"
          initialSortDir="asc"
        />
      </CollapsibleCard>

      <CollapsibleCard
        title="Donut Catch Leaderboard"
        description="Top 25 personal bests."
      >
        <SortableTable
          columns={donutColumns}
          rows={donutRows}
          rowKey={(row) => row.userId}
          initialSortKey="score"
        />
      </CollapsibleCard>
    </>
  )
}
