/**
 * Test script to verify inline achievement awards work correctly
 * Simulates what happens during the scoring cron
 */

import { PrismaClient } from "@prisma/client"
import { config } from "dotenv"
import { processPickAchievements } from "../src/lib/achievement-awards"

config({ path: ".env.local" })
const prisma = new PrismaClient()

async function main() {
  console.log("🧪 Testing inline achievement awards...\n")

  // Find a submission with a correct opener pick
  const openerPick = await prisma.pick.findFirst({
    where: {
      pickType: "OPENER",
      wasPlayed: true,
    },
    include: {
      submission: {
        include: {
          user: {
            select: { id: true, username: true },
          },
          show: {
            select: { showDate: true, venue: true },
          },
          picks: {
            include: {
              song: true,
            },
          },
        },
      },
      song: true,
    },
  })

  if (!openerPick) {
    console.log("❌ No correct opener picks found to test with")
    return
  }

  console.log(
    `✓ Found test case: ${openerPick.submission.user.username} picked ${openerPick.song.name} as opener`
  )
  console.log(`  Show: ${openerPick.submission.show.venue}`)
  console.log(`  wasPlayed: ${openerPick.wasPlayed}\n`)

  // Simulate scoring by calling processPickAchievements
  // This simulates a pick that just changed from null to true
  const scoredPicks = [
    {
      id: openerPick.id,
      wasPlayed: true,
      previousWasPlayed: null, // Simulate first time being scored
    },
  ]

  console.log("🎯 Processing achievements...")

  const result = await processPickAchievements(scoredPicks, {
    userId: openerPick.submission.user.id,
    show: {
      showDate: openerPick.submission.show.showDate,
      venue: openerPick.submission.show.venue,
    },
    picks: openerPick.submission.picks,
  })

  console.log(`\n📊 Results:`)
  console.log(`  - Awarded: ${result.awarded}`)
  console.log(`  - Errors: ${result.errors}`)

  if (result.awarded > 0) {
    console.log(
      `\n✅ Success! Achievement would be awarded during scoring cron`
    )
  } else {
    console.log(`\nℹ️  No new achievements (user likely already has it)`)
  }

  // Check if user has the achievement now
  const userAchievements = await prisma.userAchievement.findMany({
    where: {
      userId: openerPick.submission.user.id,
    },
    include: {
      achievement: true,
    },
  })

  console.log(
    `\n🏆 ${openerPick.submission.user.username}'s current achievements:`
  )
  userAchievements.forEach((ua) => {
    console.log(`  - ${ua.achievement.name}`)
  })

  console.log("\n✨ Test complete!")
}

main()
  .catch((error) => {
    console.error("Error running test:", error)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
