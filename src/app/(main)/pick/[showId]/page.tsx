import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { notFound, redirect } from "next/navigation"
import { hasShowStarted } from "@/lib/phishnet"
import { SongPicker } from "@/components/SongPicker"

interface PickPageProps {
  params: Promise<{ showId: string }>
}

async function getShowData(showId: string, userId: string) {
  const show = await prisma.show.findUnique({
    where: { id: showId },
    include: {
      submissions: {
        where: { userId },
        include: {
          picks: {
            include: { song: true },
          },
        },
      },
    },
  })

  if (!show) return null

  // Check if show has started (now timezone-aware)
  // Extract the date in UTC to avoid timezone conversion
  const showDateStr = show.showDate.toISOString().split("T")[0]
  const isLocked = await hasShowStarted(showDateStr, show.timezone, show.state)

  return { show, isLocked }
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

export default async function PickPage({ params }: PickPageProps) {
  const session = await auth()
  if (!session?.user?.id) {
    redirect("/login")
  }

  const { showId } = await params
  const [showData, songs] = await Promise.all([
    getShowData(showId, session.user.id),
    getAllSongs(),
  ])

  if (!showData) {
    notFound()
  }

  const { show, isLocked } = showData
  const existingSubmission = show.submissions[0]

  // Transform existing picks for the picker
  const existingPicks = existingSubmission?.picks.map((pick) => ({
    songId: pick.songId,
    songName: pick.song.name,
    pickType: pick.pickType,
  }))

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
        existingPicks={existingPicks}
        isLocked={isLocked}
        currentScore={existingSubmission?.totalPoints}
      />
    </div>
  )
}
