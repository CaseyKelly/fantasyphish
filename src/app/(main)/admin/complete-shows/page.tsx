import { auth } from "@/lib/auth"
import { redirect, notFound } from "next/navigation"
import { Metadata } from "next"
import Link from "next/link"
import { ArrowLeft } from "lucide-react"
import { prisma } from "@/lib/prisma"
import { withRetry } from "@/lib/db-retry"
import CompleteShowsClient from "./CompleteShowsClient"

export const metadata: Metadata = {
  title: "In-Progress Shows",
  robots: {
    index: false,
    follow: false,
  },
}

export default async function AdminCompleteShowsPage() {
  const session = await auth()
  if (!session?.user?.id) {
    redirect("/login")
  }

  const isAdmin = session.impersonating?.originalIsAdmin ?? session.user.isAdmin
  if (!isAdmin) {
    notFound()
  }

  const shows = await withRetry(
    () =>
      prisma.show.findMany({
        where: {
          isComplete: false,
          lockTime: { lte: new Date() },
        },
        select: {
          id: true,
          venue: true,
          city: true,
          state: true,
          showDate: true,
          setlistJson: true,
          encoreStartedAt: true,
          lastEncoreCount: true,
          _count: { select: { submissions: true } },
        },
        orderBy: { showDate: "asc" },
      }),
    { operationName: "find in-progress shows for admin" }
  )

  const rows = shows.map((show) => ({
    id: show.id,
    venue: show.venue,
    city: show.city,
    state: show.state,
    showDate: show.showDate.toISOString(),
    hasSetlist: show.setlistJson !== null,
    encoreStartedAt: show.encoreStartedAt?.toISOString() ?? null,
    submissionCount: show._count.submissions,
  }))

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
          In-Progress Shows
        </h1>
        <p className="mt-1 text-gray-400">
          Shows currently being tracked by the scoring cron. Mark one complete
          if you&apos;ve confirmed the encore has ended and don&apos;t want to
          wait out the grace period.
        </p>
      </div>

      <CompleteShowsClient initialShows={rows} />
    </div>
  )
}
