import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { withRetry } from "@/lib/db-retry"
import { getTimezoneForLocation, getShowLockTime } from "@/lib/timezone"
import { shouldRunCronJobs } from "@/lib/cron-helpers"

const PHISHNET_API_BASE = "https://api.phish.net/v5"

/**
 * Check if a tour name indicates the show is not part of a real tour.
 * Shows with these tour names should have tourId set to null.
 */
function isNotPartOfTour(tourName: string): boolean {
  const normalizedName = tourName.trim().toLowerCase()
  return (
    normalizedName === "" ||
    normalizedName === "not part of a tour" ||
    normalizedName === "not part of tour" ||
    normalizedName.includes("not part of")
  )
}

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
  toursCreated: number
  toursUpdated: number
  showsCreated: number
  showsUpdated: number
  showsSkipped: number
  showsSkippedComplete: number
}> {
  console.log(`[Sync Tours] Starting sync for year ${year}`)

  const allShows = await fetchShowsByYear(year)
  console.log(`[Sync Tours] Fetched ${allShows.length} total shows`)

  // Filter for Phish shows only (artistid: 1)
  const shows = allShows.filter((show) => show.artistid === 1)
  console.log(`[Sync Tours] Filtered to ${shows.length} Phish shows`)

  // Group shows by tour (excluding shows that are "not part of a tour")
  const tourMap = new Map<number, { name: string; shows: PhishNetShow[] }>()
  const nonTourShows: PhishNetShow[] = [] // Shows not part of any real tour

  for (const show of shows) {
    // Skip shows that are "not part of a tour" - treat them as standalone shows
    if (isNotPartOfTour(show.tour_name)) {
      nonTourShows.push(show)
      continue
    }

    if (!tourMap.has(show.tourid)) {
      tourMap.set(show.tourid, {
        name: show.tour_name,
        shows: [],
      })
    }
    tourMap.get(show.tourid)!.shows.push(show)
  }

  console.log(`[Sync Tours] Found ${tourMap.size} tours`)

  let toursCreated = 0
  let toursUpdated = 0
  let showsCreated = 0
  let showsUpdated = 0
  let showsSkipped = 0
  let showsSkippedComplete = 0

  // Batch fetch all existing tours and shows for this year
  const tourIds = Array.from(tourMap.keys()).map((id) => `phishnet-${id}`)
  const existingTours = await withRetry(
    async () =>
      prisma.tour.findMany({
        where: { id: { in: tourIds } },
      }),
    { operationName: "fetch existing tours" }
  )
  const existingToursMap = new Map(existingTours.map((t) => [t.id, t]))

  const allShowDates = shows.map((show) => {
    const date = new Date(show.showdate)
    date.setUTCHours(0, 0, 0, 0)
    return date
  })
  const existingShows = await withRetry(
    async () =>
      prisma.show.findMany({
        where: { showDate: { in: allShowDates } },
      }),
    { operationName: "fetch existing shows" }
  )
  const existingShowsMap = new Map(
    existingShows.map((s) => [s.showDate.getTime(), s])
  )

  // Create/update tours and shows
  for (const [tourId, tourData] of tourMap) {
    // Sort shows by date
    tourData.shows.sort(
      (a, b) => new Date(a.showdate).getTime() - new Date(b.showdate).getTime()
    )

    const firstShow = tourData.shows[0]
    const lastShow = tourData.shows[tourData.shows.length - 1]

    const tourIdStr = `phishnet-${tourId}`
    const existingTour = existingToursMap.get(tourIdStr)

    const tourStartDate = new Date(firstShow.showdate)
    const tourEndDate = new Date(lastShow.showdate)

    const tourNeedsUpdate =
      !existingTour ||
      existingTour.name !== tourData.name ||
      existingTour.startDate.getTime() !== tourStartDate.getTime() ||
      existingTour.endDate?.getTime() !== tourEndDate.getTime()

    // Create or update tour only if needed
    if (!existingTour) {
      await withRetry(
        async () =>
          prisma.tour.create({
            data: {
              id: tourIdStr,
              name: tourData.name,
              startDate: tourStartDate,
              endDate: tourEndDate,
            },
          }),
        { operationName: `create tour ${tourData.name}` }
      )
      toursCreated++
      console.log(`[Sync Tours]   ✓ Created tour: ${tourData.name}`)
    } else if (tourNeedsUpdate) {
      await withRetry(
        async () =>
          prisma.tour.update({
            where: { id: tourIdStr },
            data: {
              name: tourData.name,
              startDate: tourStartDate,
              endDate: tourEndDate,
            },
          }),
        { operationName: `update tour ${tourData.name}` }
      )
      toursUpdated++
      console.log(`[Sync Tours]   ✓ Updated tour: ${tourData.name}`)
    } else {
      console.log(`[Sync Tours]   → Skipped tour (unchanged): ${tourData.name}`)
    }

    // Create/update shows
    for (const show of tourData.shows) {
      // Normalize showDate to midnight UTC to prevent duplicate shows
      const showDate = new Date(show.showdate)
      showDate.setUTCHours(0, 0, 0, 0)

      const timezone = getTimezoneForLocation(show.state)
      const lockTime = getShowLockTime(showDate, timezone)

      const existingShow = existingShowsMap.get(showDate.getTime())

      // Don't update shows that have already been scored (setlist already fetched)
      if (existingShow?.isComplete) {
        showsSkippedComplete++
        continue
      }

      const showNeedsUpdate =
        !existingShow ||
        existingShow.venue !== show.venue ||
        existingShow.city !== show.city ||
        existingShow.state !== show.state ||
        existingShow.country !== show.country ||
        existingShow.tourId !== tourIdStr ||
        existingShow.timezone !== timezone ||
        existingShow.lockTime?.getTime() !== lockTime.getTime()

      if (!existingShow) {
        await withRetry(
          async () =>
            prisma.show.create({
              data: {
                showDate: showDate,
                venue: show.venue,
                city: show.city,
                state: show.state,
                country: show.country,
                tourId: tourIdStr,
                timezone: timezone,
                lockTime: lockTime,
              },
            }),
          { operationName: `create show ${show.venue}` }
        )
        showsCreated++
      } else if (showNeedsUpdate) {
        await withRetry(
          async () =>
            prisma.show.update({
              where: { showDate: showDate },
              data: {
                venue: show.venue,
                city: show.city,
                state: show.state,
                country: show.country,
                tourId: tourIdStr,
                timezone: timezone,
                lockTime: lockTime,
              },
            }),
          { operationName: `update show ${show.venue}` }
        )
        showsUpdated++
      } else {
        showsSkipped++
      }
    }
  }

  // Process shows that are not part of any tour
  console.log(
    `[Sync Tours] Processing ${nonTourShows.length} shows not part of a tour`
  )
  for (const show of nonTourShows) {
    // Normalize showDate to midnight UTC to prevent duplicate shows
    const showDate = new Date(show.showdate)
    showDate.setUTCHours(0, 0, 0, 0)

    const timezone = getTimezoneForLocation(show.state)
    const lockTime = getShowLockTime(showDate, timezone)

    const existingShow = existingShowsMap.get(showDate.getTime())

    // Don't update shows that have already been scored
    if (existingShow?.isComplete) {
      showsSkippedComplete++
      continue
    }

    const showNeedsUpdate =
      !existingShow ||
      existingShow.venue !== show.venue ||
      existingShow.city !== show.city ||
      existingShow.state !== show.state ||
      existingShow.country !== show.country ||
      existingShow.tourId !== null || // Update if currently linked to a tour
      existingShow.timezone !== timezone ||
      existingShow.lockTime?.getTime() !== lockTime.getTime()

    if (!existingShow) {
      await withRetry(
        async () =>
          prisma.show.create({
            data: {
              showDate: showDate,
              venue: show.venue,
              city: show.city,
              state: show.state,
              country: show.country,
              tourId: null, // No tour association
              timezone: timezone,
              lockTime: lockTime,
            },
          }),
        { operationName: `create standalone show ${show.venue}` }
      )
      showsCreated++
    } else if (showNeedsUpdate) {
      await withRetry(
        async () =>
          prisma.show.update({
            where: { showDate: showDate },
            data: {
              venue: show.venue,
              city: show.city,
              state: show.state,
              country: show.country,
              tourId: null, // Unlink from any tour
              timezone: timezone,
              lockTime: lockTime,
            },
          }),
        { operationName: `update standalone show ${show.venue}` }
      )
      showsUpdated++
    } else {
      showsSkipped++
    }
  }

  console.log(
    `[Sync Tours] Year ${year} summary: ${toursCreated} tours created, ${toursUpdated} tours updated, ${showsCreated} shows created, ${showsUpdated} shows updated, ${showsSkipped} shows skipped (unchanged), ${showsSkippedComplete} shows skipped (already scored)`
  )

  return {
    tours: tourMap.size,
    shows: shows.length,
    toursCreated,
    toursUpdated,
    showsCreated,
    showsUpdated,
    showsSkipped,
    showsSkippedComplete,
  }
}

export async function POST(request: Request) {
  const startTime = Date.now()
  console.log(`[Sync Tours] Cron job started at ${new Date().toISOString()}`)

  try {
    // Verify cron secret (optional, for security)
    // Vercel cron jobs send "Vercel-Cron" as user-agent
    // Manual triggers require the CRON_SECRET
    const authHeader = request.headers.get("authorization")
    const userAgent = request.headers.get("user-agent")
    const token = authHeader?.replace("Bearer ", "")
    const cronSecret = process.env.CRON_SECRET
    const isVercelCron = userAgent === "Vercel-Cron"

    console.log(
      `[Sync Tours] Auth check: cronSecret=${cronSecret ? "SET" : "NOT_SET"}, authHeader=${authHeader ? "PROVIDED" : "MISSING"}, isVercelCron=${isVercelCron}`
    )

    // Allow requests from:
    // 1. Vercel cron (user-agent: "Vercel-Cron")
    // 2. Manual triggers with correct CRON_SECRET
    if (!isVercelCron && cronSecret && token !== cronSecret) {
      console.error(
        "[Sync Tours] Unauthorized: not Vercel cron and invalid/missing CRON_SECRET"
      )
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    console.log("[Sync Tours] Authorization successful")

    // Check if cron jobs should run (only when tours are active)
    const { shouldRun, reason } = await shouldRunCronJobs()
    if (!shouldRun) {
      console.log(`[Sync Tours] Skipping: ${reason}`)
      return NextResponse.json({ skipped: true, reason }, { status: 200 })
    }

    console.log("[Sync Tours] Active tours found, proceeding with tour sync")

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
          toursCreated: currentYearResult.toursCreated,
          toursUpdated: currentYearResult.toursUpdated,
          showsCreated: currentYearResult.showsCreated,
          showsUpdated: currentYearResult.showsUpdated,
          showsSkipped: currentYearResult.showsSkipped,
          showsSkippedComplete: currentYearResult.showsSkippedComplete,
        },
        {
          year: nextYear,
          tours: nextYearResult.tours,
          shows: nextYearResult.shows,
          toursCreated: nextYearResult.toursCreated,
          toursUpdated: nextYearResult.toursUpdated,
          showsCreated: nextYearResult.showsCreated,
          showsUpdated: nextYearResult.showsUpdated,
          showsSkipped: nextYearResult.showsSkipped,
          showsSkippedComplete: nextYearResult.showsSkippedComplete,
        },
      ],
      totalTours: currentYearResult.tours + nextYearResult.tours,
      totalShows: currentYearResult.shows + nextYearResult.shows,
      totalToursCreated:
        currentYearResult.toursCreated + nextYearResult.toursCreated,
      totalToursUpdated:
        currentYearResult.toursUpdated + nextYearResult.toursUpdated,
      totalShowsCreated:
        currentYearResult.showsCreated + nextYearResult.showsCreated,
      totalShowsUpdated:
        currentYearResult.showsUpdated + nextYearResult.showsUpdated,
      totalShowsSkipped:
        currentYearResult.showsSkipped + nextYearResult.showsSkipped,
      totalShowsSkippedComplete:
        currentYearResult.showsSkippedComplete +
        nextYearResult.showsSkippedComplete,
    }

    console.log(`[Sync Tours] ✓ Sync complete in ${duration}ms`)
    console.log(
      `[Sync Tours] Summary: ${summary.totalShows} shows across ${summary.totalTours} tours (${summary.totalShowsCreated} created, ${summary.totalShowsUpdated} updated, ${summary.totalShowsSkipped} skipped unchanged, ${summary.totalShowsSkippedComplete} skipped already scored)`
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

// GET endpoint - Vercel cron jobs use GET requests
// This is the main entry point for the cron job
export async function GET(request: Request) {
  // Vercel cron makes GET requests, so we handle the sync here
  // Just delegate to POST handler
  return POST(request)
}
