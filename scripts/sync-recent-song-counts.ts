import { PrismaClient } from "@prisma/client"
import { config } from "dotenv"

// Load environment variables from .env.local (with override to take precedence over .env)
config({ path: ".env.local", override: true })
config({ path: ".env" })

const prisma = new PrismaClient()

const PHISHNET_API_BASE = "https://api.phish.net/v5"
const YEARS_TO_INCLUDE = 5

interface PhishNetResponse<T> {
  error: boolean
  error_message: string
  data: T
}

interface PhishNetShow {
  showid: number
  showdate: string
  venue: string
  city: string
  state: string
  country: string
}

interface PhishNetSetlistSong {
  songid: number
  song: string
  slug: string
  position: number
  set: string
  isjam: number
  isreprise: number
  transition: string
  footnote: string
}

async function fetchPhishNet<T>(endpoint: string): Promise<T> {
  const apiKey = process.env.PHISHNET_API_KEY
  if (!apiKey) {
    throw new Error("PHISHNET_API_KEY is not set")
  }

  const url = `${PHISHNET_API_BASE}${endpoint}?apikey=${apiKey}`
  const response = await fetch(url)

  if (!response.ok) {
    throw new Error(`API error: ${response.status} ${response.statusText}`)
  }

  const json: PhishNetResponse<T> = await response.json()

  if (json.error) {
    throw new Error(`API error: ${json.error_message}`)
  }

  return json.data || ([] as T)
}

async function main() {
  console.log(
    `Starting recent song count sync (last ${YEARS_TO_INCLUDE} years)...\n`
  )

  try {
    // Safety check: Prevent accidental writes to production database from development environment
    const nodeEnv = process.env.NODE_ENV || "development"
    const dbUrl = process.env.DATABASE_URL || ""
    const prodDbUrl = process.env.PROD_DATABASE_URL || ""

    // Check if DATABASE_URL is exactly the same as PROD_DATABASE_URL
    const isProductionDb = dbUrl === prodDbUrl

    // For Neon: check if we're using a branch (safe) or main (dangerous)
    const isNeonBranch =
      dbUrl.includes("neon.tech") &&
      (dbUrl.includes("branch=") || dbUrl.includes("branch%3D"))

    if (nodeEnv !== "production" && isProductionDb) {
      console.error("\n⚠️  SAFETY CHECK FAILED!")
      console.error("You are trying to update the PRODUCTION database.")
      console.error("Your NODE_ENV is:", nodeEnv)
      console.error("But DATABASE_URL is identical to PROD_DATABASE_URL.")
      console.error("\nTo fix this:")
      console.error("1. Create a Neon branch for development:")
      console.error("   npm run db:create-branch")
      console.error("2. Update your .env.local with the branch URL")
      console.error("3. Set NODE_ENV=development in your .env.local")
      console.error("\nOr, if you really want to update production, run:")
      console.error("   NODE_ENV=production npm run db:sync-recent-songs")
      process.exit(1)
    }

    if (isProductionDb && !isNeonBranch) {
      console.log("\n⚠️  Running against PRODUCTION database")
      console.log("Waiting 3 seconds... Press Ctrl+C to cancel")
      await new Promise((resolve) => setTimeout(resolve, 3000))
    } else if (isNeonBranch) {
      console.log("\n✅ Using Neon branch database (safe for development)")
    }

    // Calculate the year range (last 5 years including current year)
    const currentYear = new Date().getFullYear()
    const startYear = currentYear - YEARS_TO_INCLUDE + 1
    const years = Array.from(
      { length: YEARS_TO_INCLUDE },
      (_, i) => startYear + i
    )

    console.log(`Fetching shows from ${startYear} to ${currentYear}...\n`)

    // Map to track song slug -> count
    const songCounts = new Map<string, number>()

    // Fetch shows for each year and count song occurrences
    for (const year of years) {
      console.log(`Fetching shows for ${year}...`)

      try {
        const shows = await fetchPhishNet<PhishNetShow[]>(
          `/shows/showyear/${year}`
        )

        if (!shows || shows.length === 0) {
          console.log(`  No shows found for ${year}`)
          continue
        }

        console.log(`  Found ${shows.length} shows in ${year}`)
        let showsProcessed = 0

        // Fetch setlist for each show
        for (const show of shows) {
          try {
            const setlist = await fetchPhishNet<PhishNetSetlistSong[]>(
              `/setlists/showdate/${show.showdate}`
            )

            if (setlist && setlist.length > 0) {
              // Count each unique song once per show (ignore reprises/duplicates)
              const seenSlugs = new Set<string>()
              for (const song of setlist) {
                if (!seenSlugs.has(song.slug)) {
                  seenSlugs.add(song.slug)
                  songCounts.set(
                    song.slug,
                    (songCounts.get(song.slug) || 0) + 1
                  )
                }
              }

              showsProcessed++
            }

            // Add a small delay to avoid rate limiting
            await new Promise((resolve) => setTimeout(resolve, 100))
          } catch (error) {
            console.error(
              `  Error fetching setlist for ${show.showdate}:`,
              error instanceof Error ? error.message : error
            )
            // Continue with next show
          }
        }

        console.log(`  Processed ${showsProcessed} shows from ${year}`)
      } catch (error) {
        console.error(
          `Error fetching shows for ${year}:`,
          error instanceof Error ? error.message : error
        )
        // Continue with next year
      }
    }

    console.log(`\nCounted ${songCounts.size} unique songs`)
    console.log("Updating database...\n")

    // Reset all recentTimesPlayed counts to 0 first
    await prisma.song.updateMany({
      data: { recentTimesPlayed: 0 },
    })

    // Update each song's recent count in batches to avoid overwhelming the database
    let updated = 0
    let notFound = 0

    const entries = Array.from(songCounts.entries())
    const batchSize = 50

    for (let i = 0; i < entries.length; i += batchSize) {
      const batch = entries.slice(i, i + batchSize)

      await Promise.all(
        batch.map(async ([slug, count]) => {
          try {
            const result = await prisma.song.updateMany({
              where: { slug },
              data: { recentTimesPlayed: count },
            })

            if (result.count > 0) {
              updated++
            } else {
              notFound++
              console.log(`  Warning: Song with slug "${slug}" not found in DB`)
            }
          } catch (error) {
            console.error(
              `  Error updating song "${slug}":`,
              error instanceof Error ? error.message : error
            )
          }
        })
      )

      // Log progress
      console.log(
        `  Updated ${Math.min(i + batchSize, entries.length)}/${entries.length} songs`
      )
    }

    console.log(`\nSync complete!`)
    console.log(`- Updated: ${updated} songs`)
    console.log(`- Not found in DB: ${notFound} songs`)
    console.log(
      `- Songs with 0 recent plays: ${(await prisma.song.count()) - updated}`
    )

    // Show top 10 most played songs in last 5 years
    const topSongs = await prisma.song.findMany({
      orderBy: [{ recentTimesPlayed: "desc" }, { name: "asc" }],
      take: 10,
      select: {
        name: true,
        recentTimesPlayed: true,
        timesPlayed: true,
      },
    })

    console.log(`\nTop 10 most played songs (last ${YEARS_TO_INCLUDE} years):`)
    topSongs.forEach((song, i) => {
      console.log(
        `${i + 1}. ${song.name}: ${song.recentTimesPlayed} recent / ${song.timesPlayed} all-time`
      )
    })
  } catch (error) {
    console.error("Sync failed:", error)
    process.exit(1)
  } finally {
    await prisma.$disconnect()
  }
}

main()
