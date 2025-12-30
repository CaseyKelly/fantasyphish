import { NextResponse } from "next/server"
import { PrismaClient } from "@prisma/client"

const prisma = new PrismaClient()

const PHISHNET_API_BASE = "https://api.phish.net/v5"

interface PhishNetSong {
  songid: number
  song: string
  slug: string
  artist: string
  debut: string
  last_played: string
  times_played: number
  gap: number
}

interface PhishNetResponse<T> {
  error: boolean
  error_message: string
  data: T
}

async function fetchSongs(): Promise<PhishNetSong[]> {
  const apiKey = process.env.PHISHNET_API_KEY
  if (!apiKey) {
    throw new Error("PHISHNET_API_KEY is not set")
  }

  console.log("[Sync Song Stats] Fetching songs from phish.net API...")
  const response = await fetch(`${PHISHNET_API_BASE}/songs?apikey=${apiKey}`, {
    cache: "no-store",
  })

  if (!response.ok) {
    throw new Error(`API error: ${response.status} ${response.statusText}`)
  }

  const json: PhishNetResponse<PhishNetSong[]> = await response.json()

  if (json.error) {
    throw new Error(`API error: ${json.error_message}`)
  }

  return json.data || []
}

export async function POST(request: Request) {
  const startTime = Date.now()

  try {
    console.log(
      `[Sync Song Stats] Cron job started at ${new Date().toISOString()}`
    )

    // Verify authorization
    const authHeader = request.headers.get("authorization")
    const cronSecret = process.env.CRON_SECRET

    if (!cronSecret) {
      console.error("[Sync Song Stats] ✗ CRON_SECRET not configured")
      return NextResponse.json(
        { error: "CRON_SECRET not configured" },
        { status: 500 }
      )
    }

    if (authHeader !== `Bearer ${cronSecret}`) {
      console.error("[Sync Song Stats] ✗ Unauthorized request")
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    console.log("[Sync Song Stats] Authorization successful")

    // Fetch songs from Phish.net
    const songs = await fetchSongs()
    console.log(
      `[Sync Song Stats] Fetched ${songs.length} songs from phish.net`
    )

    let updated = 0
    let errors = 0

    for (const song of songs) {
      try {
        // Parse last_played date if available (expected format: YYYY-MM-DD)
        let lastPlayedDate: Date | null = null
        if (song.last_played) {
          const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(song.last_played)
          if (match) {
            const [, yearStr, monthStr, dayStr] = match
            const year = Number(yearStr)
            const month = Number(monthStr) - 1 // JS months are 0-based
            const day = Number(dayStr)
            lastPlayedDate = new Date(Date.UTC(year, month, day))
          } else {
            console.warn(
              `[Sync Song Stats] Unexpected last_played format for song "${song.slug}": ${song.last_played}`
            )
          }
        }

        await prisma.song.update({
          where: { slug: song.slug },
          data: {
            timesPlayed: song.times_played || 0,
            gap: song.gap,
            lastPlayed: lastPlayedDate,
          },
        })
        updated++
      } catch (error) {
        // Song might not exist in our database yet, skip it
        errors++
        if (errors <= 5) {
          // Only log first 5 errors to avoid spam
          console.error(
            `[Sync Song Stats] Error updating ${song.slug}:`,
            error instanceof Error ? error.message : "Unknown error"
          )
        }
      }
    }

    const duration = Date.now() - startTime
    console.log(
      `[Sync Song Stats] ✓ Sync complete in ${duration}ms: ${updated} updated, ${errors} errors`
    )

    return NextResponse.json({
      success: true,
      updated,
      errors,
      total: songs.length,
      duration: `${duration}ms`,
    })
  } catch (error) {
    const duration = Date.now() - startTime
    console.error("[Sync Song Stats] ✗ Sync failed:", error)

    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
        duration: `${duration}ms`,
      },
      { status: 500 }
    )
  } finally {
    await prisma.$disconnect()
  }
}
