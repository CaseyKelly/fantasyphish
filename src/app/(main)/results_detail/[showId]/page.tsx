import { auth } from "@/lib/auth"
import { redirect } from "next/navigation"
import { isAdminFeaturesEnabled } from "@/lib/env"
import ResultsClient from "./ResultsClient"

interface ResultsPageProps {
  params: Promise<{ showId: string }>
}

export default async function ResultsPage({ params }: ResultsPageProps) {
  const session = await auth()
  if (!session?.user?.id) {
    redirect("/login")
  }

  const { showId } = await params
  const showAdminControls = !!session.user.isAdmin && isAdminFeaturesEnabled()

  return <ResultsClient showId={showId} isAdmin={showAdminControls} />
}
