import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { notFound, redirect } from "next/navigation"
import { hasShowStarted } from "@/lib/phishnet"
import { SongPicker } from "@/components/SongPicker"
import { Metadata } from "next"
import { withRetry } from "@/lib/db-retry"
import Link from "next/link"

interface PickPageProps {
  params: Promise<{ showId: string }>
}

export async function generateMetadata({
  params,
}: PickPageProps): Promise<Metadata> {
  const { showId } = await params

  const show = await withRetry(
    () =>
      prisma.show.findUnique({
        where: { id: showId },
        include: { tour: true },
      }),
    { operationName: "find show for pick metadata" }
  )

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

  const title = `Make Picks for Phish at ${show.venue} - ${show.city}, ${show.state}`
  const tourInfo = show.tour ? ` Part of the ${show.tour.name}.` : ""
  const description = `Make your song picks for Phish at ${show.venue} in ${show.city}, ${show.state} on ${showDateStr}.${tourInfo}`

  return {
    title,
    description,
    openGraph: {
      title: `${title} | FantasyPhish`,
      description,
    },
    alternates: {
      canonical: `/pick/${showId}`,
    },
  }
}

async function getShowData(showId: string, userId: string) {
  const show = await withRetry(
    () =>
      prisma.show.findUnique({
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
      }),
    { operationName: "find show for picks" }
  )

  if (!show) return null

  // Check if show has started (now timezone-aware)
  // Extract the date in UTC to avoid timezone conversion
  const showDateStr = show.showDate.toISOString().split("T")[0]
  const isLocked = await hasShowStarted(showDateStr, show.timezone, show.state)

  return { show, isLocked }
}

async function hasNotificationsEnabled(userId: string) {
  const user = await withRetry(
    () =>
      prisma.user.findUnique({
        where: { id: userId },
        select: {
          emailPickReminders: true,
          _count: { select: { pushSubscriptions: true } },
        },
      }),
    { operationName: "check notification preferences for pick page" }
  )

  return !!user?.emailPickReminders || (user?._count.pushSubscriptions ?? 0) > 0
}

async function getAllSongs() {
  return withRetry(
    () =>
      prisma.song.findMany({
        orderBy: { name: "asc" },
        select: {
          id: true,
          name: true,
          slug: true,
          artist: true,
          timesPlayed: true,
          gap: true,
          lastPlayed: true,
        },
      }),
    { operationName: "find all songs for picks" }
  )
}

export default async function PickPage({ params }: PickPageProps) {
  const session = await auth()
  if (!session?.user?.id) {
    redirect("/login")
  }

  const { showId } = await params
  const [showData, songs, notificationsEnabled] = await Promise.all([
    getShowData(showId, session.user.id),
    getAllSongs(),
    hasNotificationsEnabled(session.user.id),
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
    wasPlayed: pick.wasPlayed,
    pointsEarned: pick.pointsEarned,
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
          isComplete: show.isComplete,
        }}
        songs={songs}
        existingPicks={existingPicks}
        totalPoints={existingSubmission?.totalPoints}
        isLocked={isLocked}
      />
      {!notificationsEnabled && (
        <p className="text-center text-sm text-gray-400 mt-6">
          Want a reminder on show day if you haven&apos;t submitted picks yet?
          Set your notification preferences on{" "}
          <Link
            href={`/user/${session.user.username}`}
            className="text-red-400 underline"
          >
            your profile
          </Link>
          .
        </p>
      )}
    </div>
  )
}
