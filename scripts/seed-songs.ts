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
