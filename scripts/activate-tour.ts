/**
 * Activate a FUTURE tour to make it open for picks
 *
 * Run this script to activate a tour:
 * 1. Mark the tour status as ACTIVE
 * 2. Make the tour visible on the leaderboard
 * 3. Open the tour for pick submissions
 *
 * Usage:
 *   npx tsx scripts/activate-tour.ts "2026 Mexico"
 *   npx tsx scripts/activate-tour.ts --tour-id <tourId>
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
    console.log('  npx tsx scripts/activate-tour.ts "2026 Mexico"')
    console.log("  npx tsx scripts/activate-tour.ts --tour-id <tourId>")
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

  console.log(`\n🚀 Activating tour: ${tour.name}`)
  console.log(`   Tour ID: ${tour.id}`)
  console.log(`   Start Date: ${tour.startDate.toISOString().split("T")[0]}`)
  console.log(
    `   End Date: ${tour.endDate ? tour.endDate.toISOString().split("T")[0] : "N/A"}`
  )
  console.log(`   Total Shows: ${tour.shows.length}`)
  console.log(`   Current Status: ${tour.status}`)

  if (tour.status === "ACTIVE") {
    console.log(`\n✅ This tour is already ACTIVE`)
    console.log(`   Users can submit picks and it appears on the leaderboard.`)
    process.exit(0)
  }

  if (tour.status === "COMPLETED") {
    console.log(
      `\n⚠️  Warning: This tour is COMPLETED (showing podium results)`
    )
    console.log(`   Are you sure you want to reactivate it?`)
    console.log(
      `   This will remove the podium and allow new pick submissions.`
    )
    process.exit(1)
  }

  if (tour.status === "CLOSED") {
    console.log(`\n⚠️  Warning: This tour is CLOSED (archived to history)`)
    console.log(`   Reactivating a closed tour is unusual.`)
    console.log(`   Consider if you really want to do this.`)
    process.exit(1)
  }

  // Activate the tour
  await prisma.tour.update({
    where: { id: tour.id },
    data: { status: "ACTIVE" },
  })

  console.log(`\n✅ Tour activated successfully!`)
  console.log(`   Status changed: FUTURE → ACTIVE`)
  console.log(`   - Tour is now visible on the main leaderboard (/leaderboard)`)
  console.log(`   - Users can now submit picks for this tour's shows`)
  console.log(
    `   - First show: ${tour.shows[0]?.showDate.toISOString().split("T")[0]} at ${tour.shows[0]?.venue}`
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
