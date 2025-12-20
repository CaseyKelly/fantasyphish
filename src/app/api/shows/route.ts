import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { getUpcomingShows } from "@/lib/phishnet"

export async function GET() {
  try {
    // Fetch upcoming shows from phish.net
    const upcomingShows = await getUpcomingShows()

    // Sync with database
    for (const show of upcomingShows) {
      const showDate = new Date(show.showdate)

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
