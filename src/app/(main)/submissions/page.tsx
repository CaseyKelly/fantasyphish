import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { redirect, notFound } from "next/navigation"
import { Metadata } from "next"
import { withRetry } from "@/lib/db-retry"
import { excludeTestShows } from "@/lib/test-filters"
import { isPrivateViewerOwner } from "@/lib/private-access"
import { parseUTCDate } from "@/lib/date-utils"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { LocalDateTime } from "@/components/LocalDateTime"

export const metadata: Metadata = {
  title: "Submissions",
  robots: {
    index: false,
    follow: false,
  },
}

export default async function SubmissionsPage() {
  const session = await auth()
  if (!session?.user?.id) {
    redirect("/login")
  }

  if (!isPrivateViewerOwner(session.user.email)) {
    notFound()
  }

  const nextShow = await withRetry(
    () =>
      prisma.show.findFirst({
        where: { isComplete: false, ...excludeTestShows },
        orderBy: { showDate: "asc" },
      }),
    { operationName: "find next show for submissions viewer" }
  )

  if (!nextShow) {
    return (
      <div className="space-y-4">
        <h1 className="text-3xl font-bold font-display text-white">
          Submissions
        </h1>
        <p className="text-gray-400">No upcoming show found.</p>
      </div>
    )
  }

  const submissions = await withRetry(
    () =>
      prisma.submission.findMany({
        where: { showId: nextShow.id },
        include: {
          user: { select: { username: true } },
          picks: { include: { song: true } },
        },
        orderBy: { createdAt: "asc" },
      }),
    { operationName: "find submissions for next show" }
  )

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold font-display text-white">
          Submissions
        </h1>
        <p className="text-gray-400 mt-1">
          {nextShow.venue}
          {nextShow.city ? `, ${nextShow.city}` : ""}
          {nextShow.state ? `, ${nextShow.state}` : ""} •{" "}
          {parseUTCDate(nextShow.showDate, "MMMM d, yyyy")}
        </p>
        <p className="text-sm text-gray-500 mt-1">
          {submissions.length} submission{submissions.length === 1 ? "" : "s"}
        </p>
      </div>

      {submissions.length === 0 ? (
        <p className="text-gray-400">No picks submitted yet.</p>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {submissions.map((submission) => {
            const opener = submission.picks.find((p) => p.pickType === "OPENER")
            const encore = submission.picks.find((p) => p.pickType === "ENCORE")
            const regulars = submission.picks
              .filter((p) => p.pickType === "REGULAR")
              .sort((a, b) => a.song.name.localeCompare(b.song.name))

            return (
              <Card key={submission.id}>
                <CardHeader className="flex flex-row items-center justify-between">
                  <span className="font-semibold text-white">
                    {submission.user.username}
                  </span>
                  <LocalDateTime
                    iso={submission.createdAt.toISOString()}
                    className="text-xs text-gray-500"
                  />
                </CardHeader>
                <CardContent className="space-y-2 text-sm">
                  <p className="text-gray-300">
                    <span className="text-gray-500">Opener: </span>
                    {opener?.song.name || "—"}
                  </p>
                  <p className="text-gray-300">
                    <span className="text-gray-500">Encore: </span>
                    {encore?.song.name || "—"}
                  </p>
                  <div className="text-gray-300">
                    <span className="text-gray-500">
                      Regular picks ({regulars.length}):
                    </span>
                    <ul className="mt-1 list-disc list-inside space-y-0.5">
                      {regulars.map((pick) => (
                        <li key={pick.id}>{pick.song.name}</li>
                      ))}
                    </ul>
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}
    </div>
  )
}
