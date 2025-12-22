import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

export async function GET() {
  try {
    const songs = await prisma.song.findMany({
      orderBy: [{ timesPlayed: "desc" }, { name: "asc" }],
      select: {
        id: true,
        name: true,
        slug: true,
        artist: true,
        timesPlayed: true,
      },
    })

    const response = NextResponse.json({ songs })

    // Songs list rarely changes, cache for 1 hour
    response.headers.set(
      "Cache-Control",
      "public, s-maxage=3600, stale-while-revalidate=7200"
    )

    return response
  } catch (error) {
    console.error("Error fetching songs:", error)
    return NextResponse.json(
      { error: "Failed to fetch songs" },
      { status: 500 }
    )
  }
}
