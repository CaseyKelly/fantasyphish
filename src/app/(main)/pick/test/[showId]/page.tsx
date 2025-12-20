import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { notFound, redirect } from "next/navigation"
import { SongPicker } from "@/components/SongPicker"

interface TestPickPageProps {
  params: Promise<{ showId: string }>
}

async function getShowData(showId: string) {
  const show = await prisma.show.findUnique({
    where: { id: showId },
  })

  if (!show) return null

  // Test submissions are never locked
  return { show, isLocked: false }
}

async function getAllSongs() {
  return prisma.song.findMany({
    orderBy: { name: "asc" },
    select: {
      id: true,
      name: true,
      slug: true,
      artist: true,
      timesPlayed: true,
    },
  })
}

export default async function TestPickPage({ params }: TestPickPageProps) {
  const session = await auth()
  if (!session?.user?.id) {
    redirect("/login")
  }

  if (!session.user.isAdmin) {
    redirect("/dashboard")
  }

  const { showId } = await params
  const [showData, songs] = await Promise.all([
    getShowData(showId),
    getAllSongs(),
  ])

  if (!showData) {
    notFound()
  }

  const { show } = showData

  return (
    <div className="max-w-4xl mx-auto">
      <SongPicker
        show={{
          id: show.id,
          venue: show.venue,
          city: show.city || "",
          state: show.state || "",
          showDate: show.showDate.toISOString(),
        }}
        songs={songs}
        existingPicks={undefined}
        isLocked={false}
        isTestMode={true}
      />
    </div>
  )
}
