import { PrismaClient } from "@prisma/client"
import { config } from "dotenv"

// Load environment variables from .env.local (with override to take precedence over .env)
config({ path: ".env.local", override: true })
config({ path: ".env" })

const prisma = new PrismaClient({
  datasources: {
    db: {
      url: process.env.DATABASE_URL,
    },
  },
})

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

  console.log("Fetching songs from phish.net API...")
  const response = await fetch(`${PHISHNET_API_BASE}/songs?apikey=${apiKey}`)

  if (!response.ok) {
    throw new Error(`API error: ${response.status} ${response.statusText}`)
  }

  const json: PhishNetResponse<PhishNetSong[]> = await response.json()

  if (json.error) {
    throw new Error(`API error: ${json.error_message}`)
  }

  return json.data || []
}

async function main() {
  console.log("Starting song seed...")

  try {
    // Safety check: Prevent accidental production database writes in development
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
      console.error("You are trying to seed songs to the PRODUCTION database.")
      console.error("Your NODE_ENV is:", nodeEnv)
      console.error("But DATABASE_URL is identical to PROD_DATABASE_URL.")
      console.error("\nTo fix this:")
      console.error("1. Create a Neon branch for development:")
      console.error("   npm run db:create-branch")
      console.error("2. Update your .env.local with the branch URL")
      console.error("3. Set NODE_ENV=development in your .env.local")
      console.error("\nOr, if you really want to seed production, run:")
      console.error("   NODE_ENV=production npm run db:seed")
      process.exit(1)
    }

    if (isProductionDb && !isNeonBranch) {
      console.log("\n⚠️  Running against PRODUCTION database")
      console.log("Waiting 3 seconds... Press Ctrl+C to cancel")
      await new Promise((resolve) => setTimeout(resolve, 3000))
    } else if (isNeonBranch) {
      console.log("\n✅ Using Neon branch database (safe for development)")
    }

    const songs = await fetchSongs()
    console.log(`Fetched ${songs.length} songs from phish.net`)

    let created = 0
    let updated = 0

    for (const song of songs) {
      const result = await prisma.song.upsert({
        where: { slug: song.slug },
        create: {
          name: song.song,
          slug: song.slug,
          artist: song.artist || "Phish",
          timesPlayed: song.times_played || 0,
        },
        update: {
          name: song.song,
          artist: song.artist || "Phish",
          timesPlayed: song.times_played || 0,
        },
      })

      if (result.createdAt.getTime() === result.updatedAt.getTime()) {
        created++
      } else {
        updated++
      }
    }

    console.log(`Seed complete: ${created} created, ${updated} updated`)
  } catch (error) {
    console.error("Seed failed:", error)
    process.exit(1)
  } finally {
    await prisma.$disconnect()
  }
}

main()
