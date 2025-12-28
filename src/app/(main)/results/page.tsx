import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { redirect } from "next/navigation"
import { isAdminFeaturesEnabled } from "@/lib/env"
import ResultsClient from "./ResultsClient"

async function getResults(userId: string) {
  const submissions = await prisma.submission.findMany({
    where: { userId },
    include: {
      show: {
        include: { tour: true },
      },
      picks: {
        include: { song: true },
        orderBy: { pickType: "asc" },
      },
    },
    orderBy: {
      show: { showDate: "desc" },
    },
  })

  const scoredSubmissions = submissions.filter((s) => s.isScored)
  const totalPoints = scoredSubmissions.reduce(
    (sum, s) => sum + (s.totalPoints || 0),
    0
  )
  const totalPicks = scoredSubmissions.length * 13
  const correctPicks = scoredSubmissions.reduce(
    (sum, s) => sum + s.picks.filter((p) => p.wasPlayed).length,
    0
  )

  return {
    submissions,
    stats: {
      totalSubmissions: submissions.length,
      scoredSubmissions: scoredSubmissions.length,
      totalPoints,
      avgPoints:
        scoredSubmissions.length > 0
          ? Math.round((totalPoints / scoredSubmissions.length) * 10) / 10
          : 0,
      correctPicks,
      totalPicks,
      accuracy:
        totalPicks > 0 ? Math.round((correctPicks / totalPicks) * 100) : 0,
    },
  }
}

export default async function ResultsPage() {
  const session = await auth()
  if (!session?.user?.id) {
    redirect("/login")
  }

  const { submissions, stats } = await getResults(session.user.id)

  const showAdminControls =
    (session.user.isAdmin || false) && isAdminFeaturesEnabled()

  return (
    <ResultsClient
      submissions={submissions}
      stats={stats}
      isAdmin={showAdminControls}
    />
  )
}
