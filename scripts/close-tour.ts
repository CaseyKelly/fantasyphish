/**
 * Mark a tour as CLOSED and archive it to tour history
 *
 * Run this script right before the next tour starts to:
 * 1. Mark the tour status as CLOSED
 * 2. Move the tour to the history page
 * 3. Switch the main leaderboard to the next upcoming tour
 *
 * Usage:
 *   npx tsx scripts/close-tour.ts "NYE Run 2024-2025"
 *   npx tsx scripts/close-tour.ts --tour-id <tourId>
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
    console.log('  npx tsx scripts/close-tour.ts "NYE Run 2024-2025"')
    console.log("  npx tsx scripts/close-tour.ts --tour-id <tourId>")
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

  console.log(`\n📦 Closing tour: ${tour.name}`)
  console.log(`   Tour ID: ${tour.id}`)
  console.log(`   Start Date: ${tour.startDate.toISOString().split("T")[0]}`)
  console.log(
    `   End Date: ${tour.endDate ? tour.endDate.toISOString().split("T")[0] : "N/A"}`
  )
  console.log(`   Total Shows: ${tour.shows.length}`)
  console.log(`   Current Status: ${tour.status}`)

  if (tour.status === "CLOSED") {
    console.log(`\n⚠️  This tour is already CLOSED`)
    console.log(
      `   You can view it at: /leaderboard/history or /leaderboard/${tour.id}`
    )
    process.exit(0)
  }

  if (tour.status === "ACTIVE") {
    console.log(
      `\n⚠️  Warning: This tour is currently ACTIVE (not marked as COMPLETED)`
    )
    console.log(
      `   Consider running complete-tour.ts first to show the podium before closing.`
    )
  }

  // Get count of submissions for this tour
  const submissionCount = await prisma.submission.count({
    where: {
      show: {
        tourId: tour.id,
      },
    },
  })

  console.log(`   Total Submissions: ${submissionCount}`)

  // Update tour status to CLOSED
  await prisma.tour.update({
    where: { id: tour.id },
    data: { status: "CLOSED" },
  })

  console.log(`\n✅ Tour marked as CLOSED`)
  console.log(`   This tour has been archived and moved to the history page.`)
  console.log(`   The main leaderboard will now show the next active tour.`)

  // Check what will be shown on the main leaderboard now
  const activeTour = await prisma.tour.findFirst({
    where: {
      status: "ACTIVE",
      shows: {
        some: {},
      },
    },
    orderBy: { startDate: "asc" },
  })

  if (activeTour) {
    console.log(`\n📅 Next ACTIVE tour on main leaderboard:`)
    console.log(`   ${activeTour.name}`)
    console.log(
      `   Start Date: ${activeTour.startDate.toISOString().split("T")[0]}`
    )
  } else {
    console.log(`\n⚠️  No ACTIVE tours found - leaderboard will be empty`)

    // Check for FUTURE tours that could be activated
    const futureTours = await prisma.tour.findMany({
      where: { status: "FUTURE" },
      orderBy: { startDate: "asc" },
      take: 5,
    })

    if (futureTours.length > 0) {
      console.log(`\n🔮 Available FUTURE tours to activate:`)
      futureTours.forEach((t, index) => {
        console.log(
          `   ${index + 1}. ${t.name} (starts ${t.startDate.toISOString().split("T")[0]})`
        )
      })
      console.log(`\n💡 Activate the next tour with:`)
      console.log(
        `   npx tsx scripts/activate-tour.ts "${futureTours[0].name}"`
      )
    }
  }

  console.log(`\n📝 Access this tour's results at:`)
  console.log(`   - /leaderboard/history (list of all past tours)`)
  console.log(`   - /leaderboard/${tour.id} (direct link to this tour)`)

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
