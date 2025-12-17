import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getUpcomingShows } from "@/lib/phishnet";

export async function GET() {
  try {
    // Fetch upcoming shows from phish.net
    const upcomingShows = await getUpcomingShows();

    // Sync with database
    for (const show of upcomingShows) {
      const showDate = new Date(show.showdate);
      
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
      });
    }

    // Get shows from database (includes upcoming and recent)
    const shows = await prisma.show.findMany({
      where: {
        showDate: {
          gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000), // Last 7 days
        },
      },
      orderBy: { showDate: "asc" },
      include: {
        tour: true,
      },
    });

    return NextResponse.json({ shows });
  } catch (error) {
    console.error("Error fetching shows:", error);
    return NextResponse.json(
      { error: "Failed to fetch shows" },
      { status: 500 }
    );
  }
}
