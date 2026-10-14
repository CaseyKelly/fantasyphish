import { auth } from "@/lib/auth"
import { redirect, notFound } from "next/navigation"
import { Metadata } from "next"
import Link from "next/link"
import { ArrowLeft } from "lucide-react"
import { prisma } from "@/lib/prisma"
import { getTimezoneForLocation } from "@/lib/timezone"
import { ShowLockOverrideForm } from "./ShowLockOverrideForm"
import { ShowSetCountForm } from "./ShowSetCountForm"
import { getPickUpdateNeeded } from "@/lib/pick-rules"
import { Card, CardContent, CardHeader } from "@/components/ui/card"

export const metadata: Metadata = {
  title: "Show Settings",
  robots: {
    index: false,
    follow: false,
  },
}

export default async function AdminShowsPage() {
  const session = await auth()
  if (!session?.user?.id) {
    redirect("/login")
  }

  const isAdmin = session.impersonating?.originalIsAdmin ?? session.user.isAdmin
  if (!isAdmin) {
    notFound()
  }

  const now = new Date()
  const shows = await prisma.show.findMany({
    where: { isComplete: false },
    orderBy: { showDate: "asc" },
    select: {
      id: true,
      showDate: true,
      venue: true,
      city: true,
      state: true,
      timezone: true,
      lockTime: true,
      lockTimeOverride: true,
      setCount: true,
      submissions: {
        select: { picks: { select: { pickType: true, openerSet: true } } },
      },
    },
  })

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
          Show Settings
        </h1>
        <p className="mt-1 text-gray-400">
          Picks normally lock at 7 PM venue time. Set a manual lock time to
          override that for a specific show &mdash; it will stick across daily
          tour syncs until cleared.
        </p>
        <p className="mt-1 text-gray-400">
          Shows default to two sets, with one opener pick per set. Set the count
          for single-set or three-set shows before anyone picks if you can. Once
          picks are in it can still go up (anyone who already picked is asked to
          add the new set&apos;s opener), but not down.
        </p>
      </div>

      <Card>
        <CardHeader>
          <h2 className="text-lg font-semibold text-white">Upcoming shows</h2>
        </CardHeader>
        <CardContent className="space-y-4">
          {shows.length === 0 && (
            <p className="text-gray-400">No upcoming shows.</p>
          )}
          {shows.map((show) => (
            <div
              key={show.id}
              className="space-y-3 border-b-2 border-[#4a6b7d]/30 pb-4 last:border-b-0 last:pb-0"
            >
              <ShowLockOverrideForm
                show={{
                  id: show.id,
                  showDate: show.showDate.toISOString(),
                  venue: show.venue,
                  city: show.city,
                  state: show.state,
                  timezone: show.timezone || getTimezoneForLocation(show.state),
                  lockTime: show.lockTime ? show.lockTime.toISOString() : null,
                  lockTimeOverride: show.lockTimeOverride
                    ? show.lockTimeOverride.toISOString()
                    : null,
                }}
              />
              <ShowSetCountForm
                showId={show.id}
                setCount={show.setCount}
                submissionCount={show.submissions.length}
                submissionsNeedingUpdate={
                  show.submissions.filter(
                    (submission) =>
                      getPickUpdateNeeded(submission.picks, show.setCount) !==
                      null
                  ).length
                }
                isLocked={!!show.lockTime && show.lockTime <= now}
              />
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  )
}
