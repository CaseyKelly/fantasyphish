import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { withRetry } from "@/lib/db-retry"

export async function GET() {
  try {
    const songs = await withRetry(
      () =>
        prisma.song.findMany({
          orderBy: [{ recentTimesPlayed: "desc" }, { name: "asc" }],
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
      { operationName: "find songs" }
    )

    return NextResponse.json({ songs })
  } catch (error) {
    console.error("Error fetching songs:", error)
    return NextResponse.json(
      { error: "Failed to fetch songs" },
      { status: 500 }
    )
  }
}
