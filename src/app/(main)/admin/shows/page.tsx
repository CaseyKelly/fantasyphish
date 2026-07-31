import { auth } from "@/lib/auth"
import { redirect, notFound } from "next/navigation"
import { Metadata } from "next"
import { prisma } from "@/lib/prisma"
import { getTimezoneForLocation } from "@/lib/timezone"
import { ShowLockOverrideForm } from "./ShowLockOverrideForm"
import { Card, CardContent, CardHeader } from "@/components/ui/card"

export const metadata: Metadata = {
  title: "Show Lock Times",
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
    },
  })

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold font-display text-white">
          Show Lock Times
        </h1>
        <p className="mt-1 text-gray-400">
          Picks normally lock at 7 PM venue time. Set a manual lock time to
          override that for a specific show &mdash; it will stick across daily
          tour syncs until cleared.
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
            <ShowLockOverrideForm
              key={show.id}
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
          ))}
        </CardContent>
      </Card>
    </div>
  )
}
