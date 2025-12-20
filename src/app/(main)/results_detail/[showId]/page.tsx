import { auth } from "@/lib/auth"
import { redirect } from "next/navigation"
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

  return <ResultsClient showId={showId} isAdmin={!!session.user.isAdmin} />
}
