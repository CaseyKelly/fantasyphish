import { NextResponse } from "next/server"
import { PrismaClient } from "@prisma/client"
import { getTimezoneForLocation, getShowLockTime } from "@/lib/timezone"

const prisma = new PrismaClient()

const PHISHNET_API_BASE = "https://api.phish.net/v5"

interface PhishNetShow {
  showid: number
  showdate: string
  venue: string
  city: string
  state: string
  country: string
  tour_name: string
  tourid: number
  artistid: number
  artist_name: string
}

interface PhishNetResponse<T> {
  error: boolean
  error_message: string
  data: T
}

async function fetchShowsByYear(year: number): Promise<PhishNetShow[]> {
  const apiKey = process.env.PHISHNET_API_KEY
  if (!apiKey) {
    throw new Error("PHISHNET_API_KEY is not set")
  }

  console.log(`[Sync Tours] Fetching shows for year ${year}...`)
  const response = await fetch(
    `${PHISHNET_API_BASE}/shows/showyear/${year}.json?apikey=${apiKey}`,
    { cache: "no-store" }
  )

  if (!response.ok) {
    throw new Error(`API error: ${response.status} ${response.statusText}`)
  }

  const json: PhishNetResponse<PhishNetShow[]> = await response.json()

  if (json.error) {
    throw new Error(`API error: ${json.error_message}`)
  }

  return json.data || []
}

async function syncYear(year: number): Promise<{
  tours: number
  shows: number
}> {
  console.log(`[Sync Tours] Starting sync for year ${year}`)

  const allShows = await fetchShowsByYear(year)
  console.log(`[Sync Tours] Fetched ${allShows.length} total shows`)

  // Filter for Phish shows only (artistid: 1)
  const shows = allShows.filter((show) => show.artistid === 1)
  console.log(`[Sync Tours] Filtered to ${shows.length} Phish shows`)

  // Group shows by tour
  const tourMap = new Map<number, { name: string; shows: PhishNetShow[] }>()

  for (const show of shows) {
    if (!tourMap.has(show.tourid)) {
      tourMap.set(show.tourid, {
        name: show.tour_name,
        shows: [],
      })
    }
    tourMap.get(show.tourid)!.shows.push(show)
  }

  console.log(`[Sync Tours] Found ${tourMap.size} tours`)

  // Create/update tours and shows
  for (const [tourId, tourData] of tourMap) {
    // Sort shows by date
    tourData.shows.sort(
      (a, b) => new Date(a.showdate).getTime() - new Date(b.showdate).getTime()
    )

    const firstShow = tourData.shows[0]
    const lastShow = tourData.shows[tourData.shows.length - 1]

    // Create or update tour
    const tour = await prisma.tour.upsert({
      where: { id: `phishnet-${tourId}` },
      create: {
        id: `phishnet-${tourId}`,
        name: tourData.name,
        startDate: new Date(firstShow.showdate),
        endDate: new Date(lastShow.showdate),
      },
      update: {
        name: tourData.name,
        startDate: new Date(firstShow.showdate),
        endDate: new Date(lastShow.showdate),
      },
    })

    console.log(
      `[Sync Tours] Tour: ${tour.name} (${tourData.shows.length} shows)`
    )

    // Create/update shows
    for (const show of tourData.shows) {
      // Normalize showDate to midnight UTC to prevent duplicate shows
      const showDate = new Date(show.showdate)
      showDate.setUTCHours(0, 0, 0, 0)

      const timezone = getTimezoneForLocation(show.state)
      const lockTime = getShowLockTime(showDate, timezone)

      await prisma.show.upsert({
        where: { showDate: showDate },
        create: {
          showDate: showDate,
          venue: show.venue,
          city: show.city,
          state: show.state,
          country: show.country,
          tourId: tour.id,
          timezone: timezone,
          lockTime: lockTime,
        },
        update: {
          venue: show.venue,
          city: show.city,
          state: show.state,
          country: show.country,
          tourId: tour.id,
          timezone: timezone,
          lockTime: lockTime,
        },
      })
    }
  }

  return {
    tours: tourMap.size,
    shows: shows.length,
  }
}

export async function POST(request: Request) {
  const startTime = Date.now()
  console.log(`[Sync Tours] Cron job started at ${new Date().toISOString()}`)

  try {
    // Verify cron secret (optional, for security)
    // Vercel cron jobs send "vercel-cron/1.0" as user-agent
    // Manual triggers require the CRON_SECRET
    const authHeader = request.headers.get("authorization")
    const userAgent = request.headers.get("user-agent") || ""
    const token = authHeader?.replace("Bearer ", "")
    const cronSecret = process.env.CRON_SECRET
    const isVercelCron = userAgent.toLowerCase().startsWith("vercel-cron")

    console.log(
      `[Sync Tours] Auth check: cronSecret=${cronSecret ? "SET" : "NOT_SET"}, authHeader=${authHeader ? "PROVIDED" : "MISSING"}, isVercelCron=${isVercelCron}`
    )

    // Allow requests from:
    // 1. Vercel cron (user-agent starts with "vercel-cron")
    // 2. Manual triggers with correct CRON_SECRET
    if (!isVercelCron && cronSecret && token !== cronSecret) {
      console.error(
        "[Sync Tours] Unauthorized: not Vercel cron and invalid/missing CRON_SECRET"
      )
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    console.log("[Sync Tours] Authorization successful")

    const currentYear = new Date().getFullYear()
    const nextYear = currentYear + 1

    console.log(`[Sync Tours] Syncing years: ${currentYear}, ${nextYear}`)

    // Sync both years
    const currentYearResult = await syncYear(currentYear)
    const nextYearResult = await syncYear(nextYear)

    const duration = Date.now() - startTime

    const summary = {
      success: true,
      duration: `${duration}ms`,
      years: [
        {
          year: currentYear,
          tours: currentYearResult.tours,
          shows: currentYearResult.shows,
        },
        {
          year: nextYear,
          tours: nextYearResult.tours,
          shows: nextYearResult.shows,
        },
      ],
      totalTours: currentYearResult.tours + nextYearResult.tours,
      totalShows: currentYearResult.shows + nextYearResult.shows,
    }

    console.log(`[Sync Tours] ✓ Sync complete in ${duration}ms`)
    console.log(
      `[Sync Tours] Summary: ${summary.totalShows} shows across ${summary.totalTours} tours`
    )

    return NextResponse.json(summary)
  } catch (error) {
    const duration = Date.now() - startTime
    console.error(`[Sync Tours] ✗ Error after ${duration}ms:`, error)

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
