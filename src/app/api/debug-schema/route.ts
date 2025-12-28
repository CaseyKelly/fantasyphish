import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

export async function GET() {
  try {
    // Check if recentTimesPlayed field exists by trying to query it
    const sample = await prisma.song.findFirst({
      select: {
        name: true,
        timesPlayed: true,
        recentTimesPlayed: true,
      },
    })

    // Get the top song by recent plays
    const topRecent = await prisma.song.findMany({
      orderBy: [{ recentTimesPlayed: "desc" }],
      take: 1,
      select: {
        name: true,
        recentTimesPlayed: true,
      },
    })

    return NextResponse.json({
      schemaHasRecentTimesPlayed: true,
      sample,
      topRecent: topRecent[0],
      databaseUrl: process.env.DATABASE_URL?.substring(0, 50) + "...",
    })
  } catch (error) {
    return NextResponse.json({
      schemaHasRecentTimesPlayed: false,
      error: error instanceof Error ? error.message : "Unknown error",
      databaseUrl: process.env.DATABASE_URL?.substring(0, 50) + "...",
    })
  }
}
