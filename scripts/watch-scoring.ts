/**
 * Local Development Script: Watch and Score Shows
 *
 * This script simulates the Vercel cron job for local development.
 * It calls the /api/score endpoint every 60 seconds to update scores
 * as the show progresses.
 *
 * Usage:
 *   npm run dev (in one terminal)
 *   npx tsx scripts/watch-scoring.ts (in another terminal)
 */

const CRON_SECRET = process.env.CRON_SECRET
const API_URL = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"
const INTERVAL_MS = 60 * 1000 // 60 seconds

async function scoreShows() {
  const timestamp = new Date().toISOString()
  console.log(`\n[${timestamp}] Running scoring cron...`)

  try {
    const response = await fetch(`${API_URL}/api/score`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${CRON_SECRET}`,
        "Content-Type": "application/json",
      },
    })

    if (!response.ok) {
      const error = await response.text()
      console.error(`❌ Scoring failed (${response.status}):`, error)
      return
    }

    const result = await response.json()
    console.log(`✅ Scoring complete in ${result.duration}`)
    console.log(`   Shows processed: ${result.showsProcessed}`)

    if (result.results && result.results.length > 0) {
      for (const show of result.results) {
        console.log(`   📊 ${show.showDate} ${show.status}:`)
        console.log(`      Songs: ${show.songCount || 0}`)
        console.log(
          `      Submissions updated: ${show.submissionsUpdated || 0}/${show.submissionsProcessed || 0}`
        )
        if (show.setlist?.allSongs?.length > 0) {
          console.log(`      Latest songs: ${show.setlist.allSongs.join(", ")}`)
        }
      }
    } else {
      console.log("   No shows to score")
    }
  } catch (error) {
    console.error("❌ Error calling scoring endpoint:", error)
  }
}

async function main() {
  if (!CRON_SECRET) {
    console.error("❌ CRON_SECRET not set in environment")
    console.error("   Add CRON_SECRET to your .env.local file")
    process.exit(1)
  }

  console.log("🎵 FantasyPhish Scoring Watcher")
  console.log(`   Checking every ${INTERVAL_MS / 1000} seconds`)
  console.log(`   API: ${API_URL}`)
  console.log("\n   Press Ctrl+C to stop\n")

  // Run immediately on start
  await scoreShows()

  // Then run every minute
  setInterval(scoreShows, INTERVAL_MS)
}

main()
