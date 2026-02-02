import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { redirect } from "next/navigation"
import { isAdminFeaturesEnabled } from "@/lib/env"
import { Metadata } from "next"
import ResultsClient from "./ResultsClient"

export const metadata: Metadata = {
  title: "Results",
  description:
    "View your FantasyPhish game results, scores, and performance across all shows you've played.",
  openGraph: {
    title: "Results | FantasyPhish",
    description:
      "View your FantasyPhish game results, scores, and performance across all shows you've played.",
  },
  alternates: {
    canonical: "/results",
  },
}

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

  // Include submissions that are either scored OR locked (show has started)
  const now = new Date()
  const scoredSubmissions = submissions.filter(
    (s) => s.isScored || (s.show.lockTime && s.show.lockTime <= now)
  )
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
