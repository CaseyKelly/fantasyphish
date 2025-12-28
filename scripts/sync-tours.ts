import { PrismaClient } from "@prisma/client"
import { getTimezoneForLocation, getShowLockTime } from "../src/lib/timezone"

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

  console.log(`Fetching shows for year ${year}...`)
  const response = await fetch(
    `${PHISHNET_API_BASE}/shows/showyear/${year}.json?apikey=${apiKey}`
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

async function syncYear(year: number): Promise<void> {
  console.log(`\nSyncing tours for year ${year}...`)

  const allShows = await fetchShowsByYear(year)
  console.log(`Fetched ${allShows.length} shows`)

  // Filter for Phish shows only (artistid: 1)
  const shows = allShows.filter((show) => show.artistid === 1)
  console.log(`Filtered to ${shows.length} Phish shows`)

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

  console.log(`Found ${tourMap.size} tours`)

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

    console.log(`Tour: ${tour.name}`)

    // Create/update shows
    for (const show of tourData.shows) {
      // Normalize showDate to midnight UTC to prevent duplicate shows
      const showDate = new Date(show.showdate)
      showDate.setUTCHours(0, 0, 0, 0)

      const timezone = getTimezoneForLocation(show.state)
      const lockTime = getShowLockTime(showDate, timezone)

      // Determine if show is complete
      // A show is complete if we're past the lock time (7 PM venue time)
      // This ensures the show date remains available until showtime
      const now = new Date()
      const isComplete = now > lockTime

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
          isComplete: isComplete,
        },
        update: {
          venue: show.venue,
          city: show.city,
          state: show.state,
          country: show.country,
          tourId: tour.id,
          timezone: timezone,
          lockTime: lockTime,
          isComplete: isComplete,
        },
      })
    }

    console.log(`  - ${tourData.shows.length} shows synced`)
  }
}

async function main() {
  try {
    // If a year is specified, sync only that year
    // Otherwise, sync current year and next year
    if (process.argv[2]) {
      const year = parseInt(process.argv[2])
      console.log(`Syncing single year: ${year}`)
      await syncYear(year)
    } else {
      const currentYear = new Date().getFullYear()
      const nextYear = currentYear + 1
      console.log(`Syncing years: ${currentYear} and ${nextYear}`)
      await syncYear(currentYear)
      await syncYear(nextYear)
    }

    console.log("\n✓ Sync complete!")
  } catch (error) {
    console.error("\n✗ Sync failed:", error)
    process.exit(1)
  } finally {
    await prisma.$disconnect()
  }
}

main()
