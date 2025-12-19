// Debug script to test the admin test-submission API logic directly
/* eslint-disable @typescript-eslint/no-require-imports */
const { PrismaClient } = require("@prisma/client")
const { getSetlist } = require("./src/lib/phishnet")

const prisma = new PrismaClient()

async function testAPI() {
  try {
    console.log("🔍 Testing admin test-submission logic...")

    // Get completed shows from the database (excluding test shows)
    const existingShows = await prisma.show.findMany({
      where: {
        venue: {
          not: {
            contains: "Test Venue",
          },
        },
        // Look for completed shows (shows that have already happened)
        isComplete: true,
      },
      select: {
        id: true,
        showDate: true,
        venue: true,
        city: true,
        state: true,
      },
      orderBy: { showDate: "desc" },
      take: 10, // Get just 10 for testing
    })

    console.log(`Found ${existingShows.length} completed shows:`)
    existingShows.forEach((show, i) => {
      const dateString = show.showDate.toISOString().split("T")[0]
      console.log(
        `  ${i + 1}. ${dateString} - ${show.venue} (${show.city}, ${show.state})`
      )
      console.log(`     Original date: ${show.showDate}`)
      console.log(`     UTC ISO: ${show.showDate.toISOString()}`)
      console.log(`     Extracted date: ${dateString}`)
    })

    // Test the date conversion for the first few shows
    console.log("\n🧪 Testing phish.net date lookup for first 3 shows...")

    for (let i = 0; i < Math.min(3, existingShows.length); i++) {
      const show = existingShows[i]
      const dateString = show.showDate.toISOString().split("T")[0]

      console.log(`\nTesting ${dateString} (${show.venue}):`)
      try {
        const setlist = await getSetlist(dateString)
        console.log(
          `  ✅ Found setlist with ${setlist?.songs?.length || 0} songs`
        )
        if (setlist?.songs?.length >= 10) {
          console.log(`  🎯 This show is suitable for testing!`)
          break
        } else {
          console.log(`  ❌ Not enough songs (need 10+)`)
        }
      } catch (error) {
        console.log(`  ❌ Error: ${error.message}`)
      }
    }
  } catch (error) {
    console.error("Error:", error)
  } finally {
    await prisma.$disconnect()
  }
}

testAPI()
