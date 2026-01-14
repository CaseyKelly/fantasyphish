import { auth } from "@/lib/auth"
import { isAdminFeaturesEnabled } from "@/lib/env"
import { prisma } from "@/lib/prisma"
import { Metadata } from "next"
import ResultsClient from "./ResultsClient"

interface ResultsPageProps {
  params: Promise<{ showId: string }>
}

export async function generateMetadata({
  params,
}: ResultsPageProps): Promise<Metadata> {
  const { showId } = await params

  const show = await prisma.show.findUnique({
    where: { id: showId },
    include: {
      tour: true,
    },
  })

  if (!show) {
    return {
      title: "Show Not Found",
    }
  }

  const showDateStr = new Date(show.showDate).toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  })

  const title = `Phish at ${show.venue} - ${show.city}, ${show.state}`
  const tourInfo = show.tour ? ` Part of the ${show.tour.name}.` : ""
  const description = `View complete setlist results and player picks for Phish at ${show.venue} in ${show.city}, ${show.state} on ${showDateStr}.${tourInfo}`

  return {
    title,
    description,
    openGraph: {
      title: `${title} | FantasyPhish`,
      description,
      type: "website",
    },
    twitter: {
      card: "summary_large_image",
      title: `${title} | FantasyPhish`,
      description,
    },
    alternates: {
      canonical: `/results_detail/${showId}`,
    },
    robots: {
      index: true,
      follow: true,
    },
  }
}

export default async function ResultsPage({ params }: ResultsPageProps) {
  const session = await auth()
  // Allow public access to show results - no auth required
  // Users can view results without logging in

  const { showId } = await params
  const showAdminControls = !!session?.user?.isAdmin && isAdminFeaturesEnabled()

  return <ResultsClient showId={showId} isAdmin={showAdminControls} />
}
