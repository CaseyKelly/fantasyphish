/**
 * Mark a tour as COMPLETED to display final results/podium on leaderboard
 *
 * Run this script after the last show of a tour to:
 * 1. Mark the tour status as COMPLETED
 * 2. Display the final leaderboard with podium winners
 * 3. Keep results visible for a couple months
 *
 * Usage:
 *   npx tsx scripts/complete-tour.ts "NYE Run 2024-2025"
 *   npx tsx scripts/complete-tour.ts --tour-id <tourId>
 *
 * This script is idempotent - safe to run multiple times.
 */

import { PrismaClient } from "@prisma/client"
import { config } from "dotenv"

// Load environment variables from .env.local
config({ path: ".env.local" })
config({ path: ".env" })

const prisma = new PrismaClient()

async function main() {
  const args = process.argv.slice(2)

  if (args.length === 0) {
    console.error("❌ Error: Tour name or --tour-id required")
    console.log("\nUsage:")
    console.log('  npx tsx scripts/complete-tour.ts "NYE Run 2024-2025"')
    console.log("  npx tsx scripts/complete-tour.ts --tour-id <tourId>")
    process.exit(1)
  }

  let tour

  if (args[0] === "--tour-id") {
    const tourId = args[1]
    if (!tourId) {
      console.error("❌ Error: Tour ID required after --tour-id")
      process.exit(1)
    }

    tour = await prisma.tour.findUnique({
      where: { id: tourId },
      include: {
        shows: {
          orderBy: { showDate: "asc" },
        },
      },
    })

    if (!tour) {
      console.error(`❌ Error: Tour with ID "${tourId}" not found`)
      process.exit(1)
    }
  } else {
    const tourName = args.join(" ")

    tour = await prisma.tour.findFirst({
      where: {
        name: {
          contains: tourName,
          mode: "insensitive",
        },
      },
      include: {
        shows: {
          orderBy: { showDate: "asc" },
        },
      },
    })

    if (!tour) {
      console.error(`❌ Error: Tour "${tourName}" not found`)
      console.log("\nAvailable tours:")
      const tours = await prisma.tour.findMany({
        orderBy: { startDate: "desc" },
        take: 10,
      })
      tours.forEach((t) => {
        console.log(`  - ${t.name} (${t.status})`)
      })
      process.exit(1)
    }
  }

  console.log(`\n🎆 Completing tour: ${tour.name}`)
  console.log(`   Tour ID: ${tour.id}`)
  console.log(`   Start Date: ${tour.startDate.toISOString().split("T")[0]}`)
  console.log(
    `   End Date: ${tour.endDate ? tour.endDate.toISOString().split("T")[0] : "N/A"}`
  )
  console.log(`   Total Shows: ${tour.shows.length}`)
  console.log(`   Current Status: ${tour.status}`)

  // Check if all shows are complete
  const incompleteShows = tour.shows.filter((show) => !show.isComplete)
  if (incompleteShows.length > 0) {
    console.log(
      `\n⚠️  Warning: ${incompleteShows.length} show(s) are not yet complete:`
    )
    incompleteShows.forEach((show) => {
      console.log(
        `   - ${show.showDate.toISOString().split("T")[0]} at ${show.venue}`
      )
    })
    console.log(
      "\nYou can still mark the tour as COMPLETED, but the leaderboard may not reflect final scores."
    )
  }

  // Update tour status to COMPLETED
  await prisma.tour.update({
    where: { id: tour.id },
    data: { status: "COMPLETED" },
  })

  console.log(`\n✅ Tour marked as COMPLETED`)
  console.log(
    `   The leaderboard will now display final results with a podium banner.`
  )
  console.log(
    `   This tour will remain on the main leaderboard until you run close-tour.ts`
  )

  // TODO: Award achievements for tour winners (1st, 2nd, 3rd place)
  // Get final leaderboard standings
  const submissions = await prisma.submission.findMany({
    where: {
      show: {
        tourId: tour.id,
      },
      isScored: true,
    },
    include: {
      user: {
        select: {
          id: true,
          username: true,
        },
      },
    },
  })

  // Calculate final standings
  const userScores = new Map<
    string,
    {
      userId: string
      username: string
      totalPoints: number
      showsPlayed: number
    }
  >()

  for (const submission of submissions) {
    const existing = userScores.get(submission.userId)
    if (existing) {
      existing.totalPoints += submission.totalPoints || 0
      existing.showsPlayed += 1
    } else {
      userScores.set(submission.userId, {
        userId: submission.userId,
        username: submission.user.username,
        totalPoints: submission.totalPoints || 0,
        showsPlayed: 1,
      })
    }
  }

  const standings = Array.from(userScores.values())
    .sort((a, b) => b.totalPoints - a.totalPoints)
    .slice(0, 10) // Top 10

  console.log(`\n🏆 Final Leaderboard (Top 10):`)
  standings.forEach((entry, index) => {
    const rank = index + 1
    const medal =
      rank === 1 ? "🥇" : rank === 2 ? "🥈" : rank === 3 ? "🥉" : "  "
    console.log(
      `   ${medal} #${rank}: ${entry.username} - ${entry.totalPoints} pts (${entry.showsPlayed} shows)`
    )
  })

  console.log(`\n📝 Next Steps:`)
  console.log(
    `   1. The leaderboard will now show "Tour Complete - Final Results" banner`
  )
  console.log(`   2. Leave this status for a couple months to showcase winners`)
  console.log(
    `   3. Before the next tour starts, run: npx tsx scripts/close-tour.ts "${tour.name}"`
  )
  console.log(
    `   4. TODO: Implement achievement awarding for 1st, 2nd, 3rd place winners`
  )

  console.log(`\n🎉 Done!`)
}

main()
  .catch((error) => {
    console.error("Error running script:", error)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
