/**
 * Award NYE Run 2025 Participant achievement to all users who submitted picks
 * for any show during the NYE Run (Dec 28, 2024 - Jan 1, 2025)
 *
 * This script is idempotent - safe to run multiple times.
 *
 * Usage: npx tsx scripts/award-nye-run-achievement.ts
 */

import { PrismaClient } from "@prisma/client"
import { config } from "dotenv"
import { ACHIEVEMENT_DEFINITIONS } from "../src/lib/achievements"

// Load environment variables from .env.local
config({ path: ".env.local" })
config({ path: ".env" })

const prisma = new PrismaClient()

const NYE_RUN_START = new Date("2024-12-28T00:00:00.000Z")
const NYE_RUN_END = new Date("2025-01-02T00:00:00.000Z") // Exclusive

async function main() {
  console.log("🎆 Awarding NYE Run 2025 Participant achievements...")

  const achievementDef = ACHIEVEMENT_DEFINITIONS.NYE_RUN_2025_PARTICIPANT

  // 1. Create or get the achievement record
  const achievement = await prisma.achievement.upsert({
    where: { slug: achievementDef.slug },
    update: {
      name: achievementDef.name,
      description: achievementDef.description,
      icon: achievementDef.icon,
      category: achievementDef.category,
      metadata: achievementDef.metadata,
    },
    create: {
      slug: achievementDef.slug,
      name: achievementDef.name,
      description: achievementDef.description,
      icon: achievementDef.icon,
      category: achievementDef.category,
      metadata: achievementDef.metadata,
    },
  })

  console.log(`✓ Achievement record ready: ${achievement.name}`)

  // 2. Find all users who submitted picks for NYE Run shows
  const nyeSubmissions = await prisma.submission.findMany({
    where: {
      show: {
        showDate: {
          gte: NYE_RUN_START,
          lt: NYE_RUN_END,
        },
      },
    },
    select: {
      userId: true,
      show: {
        select: {
          showDate: true,
          venue: true,
        },
      },
    },
    distinct: ["userId"], // Get unique users
  })

  console.log(
    `Found ${nyeSubmissions.length} users who participated in NYE Run 2025`
  )

  if (nyeSubmissions.length === 0) {
    console.log("No submissions found for NYE Run 2025 shows")
    return
  }

  // 3. Award achievement to each user (skip if already awarded)
  let awarded = 0
  let skipped = 0

  for (const submission of nyeSubmissions) {
    try {
      await prisma.userAchievement.create({
        data: {
          userId: submission.userId,
          achievementId: achievement.id,
          metadata: {
            firstShowDate: submission.show.showDate,
            venue: submission.show.venue,
          },
        },
      })
      awarded++
    } catch (error: unknown) {
      // User already has this achievement (unique constraint violation)
      if (
        error &&
        typeof error === "object" &&
        "code" in error &&
        error.code === "P2002"
      ) {
        skipped++
      } else {
        console.error(`Error awarding achievement to user:`, error)
      }
    }
  }

  console.log(`\n✨ Results:`)
  console.log(`  - Awarded to ${awarded} new users`)
  console.log(`  - Skipped ${skipped} users (already have achievement)`)
  console.log(`  - Total users with achievement: ${awarded + skipped}`)
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
