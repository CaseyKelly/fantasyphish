import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { getUpcomingShows } from "@/lib/phishnet"
import { auth } from "@/lib/auth"
import { excludeTestShows } from "@/lib/test-filters"

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const nextOnly = searchParams.get("next")

    // If requesting next show only
    if (nextOnly === "true") {
      const session = await auth()

      // Get the next incomplete show (regardless of lock status)
      // The lock status is used on the client to prevent editing, not to hide the show
      // We don't filter by date at all - just get the earliest incomplete show
      const nextShow = await prisma.show.findFirst({
        where: {
          isComplete: false,
          ...excludeTestShows,
        },
        orderBy: { showDate: "asc" },
        include: {
          tour: true,
          submissions: session?.user?.id
            ? {
                where: { userId: session.user.id },
                include: {
                  picks: {
                    include: { song: true },
                  },
                },
              }
            : false,
        },
      })

      if (!nextShow) {
        return NextResponse.json({ nextShow: null })
      }

      const userSubmission =
        session?.user?.id && Array.isArray(nextShow.submissions)
          ? nextShow.submissions[0]
          : null

      return NextResponse.json({
        nextShow: {
          id: nextShow.id,
          venue: nextShow.venue,
          city: nextShow.city,
          state: nextShow.state,
          country: nextShow.country,
          showDate: nextShow.showDate,
          isComplete: nextShow.isComplete,
          lockTime: nextShow.lockTime,
          timezone: nextShow.timezone,
          tour: nextShow.tour,
          userSubmission,
        },
      })
    }

    // Fetch upcoming shows from phish.net
    const upcomingShows = await getUpcomingShows()

    // Sync with database
    for (const show of upcomingShows) {
      // Normalize showDate to midnight UTC to prevent duplicate shows
      const showDate = new Date(show.showdate)
      showDate.setUTCHours(0, 0, 0, 0)

      await prisma.show.upsert({
        where: { showDate },
        create: {
          showDate,
          venue: show.venue,
          city: show.city,
          state: show.state,
          country: show.country,
        },
        update: {
          venue: show.venue,
          city: show.city,
          state: show.state,
          country: show.country,
        },
      })
    }

    // Get shows from database (includes upcoming and recent)
    // For admin, we want all shows; for users, we could filter differently
    const shows = await prisma.show.findMany({
      where: {
        ...excludeTestShows,
        OR: [
          // Shows in the last 7 days
          {
            showDate: {
              gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
            },
          },
          // OR shows with submissions (for admin testing)
          {
            submissions: {
              some: {},
            },
          },
        ],
      },
      orderBy: { showDate: "asc" },
      include: {
        tour: true,
        _count: {
          select: { submissions: true },
        },
      },
    })

    // Format response with submission counts
    const formattedShows = shows.map((show) => ({
      id: show.id,
      venue: show.venue,
      city: show.city,
      state: show.state,
      showDate: show.showDate,
      isComplete: show.isComplete,
      lockTime: show.lockTime,
      submissionCount: show._count.submissions,
      tour: show.tour,
    }))

    return NextResponse.json({ shows: formattedShows })
  } catch (error) {
    console.error("Error fetching shows:", error)
    return NextResponse.json(
      { error: "Failed to fetch shows" },
      { status: 500 }
    )
  }
}
