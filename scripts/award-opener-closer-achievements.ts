/**
 * Award Takeoff (PERFECT_OPENER) and Landing (PERFECT_CLOSER) achievements
 * to users who correctly guessed openers and encore songs.
 *
 * This script is idempotent - safe to run multiple times.
 *
 * Usage: npx tsx scripts/award-opener-closer-achievements.ts
 */

import { PrismaClient } from "@prisma/client"
import { config } from "dotenv"
import { ACHIEVEMENT_DEFINITIONS } from "../src/lib/achievements"

// Load environment variables from .env.local
config({ path: ".env.local" })
config({ path: ".env" })

const prisma = new PrismaClient()

async function awardAchievement(
  achievementSlug: "PERFECT_OPENER" | "PERFECT_CLOSER",
  pickType: "OPENER" | "ENCORE"
) {
  const achievementDef = ACHIEVEMENT_DEFINITIONS[achievementSlug]
  const pickTypeName = pickType === "OPENER" ? "opener" : "encore"

  console.log(
    `\n${achievementDef.icon} Awarding ${achievementDef.name} achievements...`
  )

  // 1. Create or update the achievement record
  const achievement = await prisma.achievement.upsert({
    where: { slug: achievementDef.slug },
    update: {
      name: achievementDef.name,
      description: achievementDef.description,
      icon: achievementDef.icon,
      category: achievementDef.category,
    },
    create: {
      slug: achievementDef.slug,
      name: achievementDef.name,
      description: achievementDef.description,
      icon: achievementDef.icon,
      category: achievementDef.category,
    },
  })

  console.log(`✓ Achievement record ready: ${achievement.name}`)

  // 2. Find all picks where user correctly guessed the opener/encore
  const correctPicks = await prisma.pick.findMany({
    where: {
      pickType: pickType,
      wasPlayed: true,
    },
    include: {
      submission: {
        include: {
          show: true,
          user: {
            select: {
              id: true,
              username: true,
            },
          },
        },
      },
      song: {
        select: {
          name: true,
        },
      },
    },
  })

  console.log(`Found ${correctPicks.length} correct ${pickTypeName} picks`)

  if (correctPicks.length === 0) {
    console.log(`No correct ${pickTypeName} picks found`)
    return { awarded: 0, skipped: 0 }
  }

  // 3. Get unique users who made correct picks
  const userPicksMap = new Map<string, (typeof correctPicks)[0]>()

  for (const pick of correctPicks) {
    const userId = pick.submission.user.id
    // Store the first correct pick for each user (for metadata)
    if (!userPicksMap.has(userId)) {
      userPicksMap.set(userId, pick)
    }
  }

  console.log(
    `Found ${userPicksMap.size} unique users with correct ${pickTypeName} picks`
  )

  // 4. Award achievement to each user (skip if already awarded)
  let awarded = 0
  let skipped = 0

  for (const [userId, pick] of userPicksMap.entries()) {
    try {
      await prisma.userAchievement.create({
        data: {
          userId: userId,
          achievementId: achievement.id,
          metadata: {
            firstCorrectShow: pick.submission.show.showDate,
            venue: pick.submission.show.venue,
            songName: pick.song.name,
          },
        },
      })
      awarded++
      console.log(`  ✓ Awarded to ${pick.submission.user.username}`)
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
        console.error(
          `Error awarding achievement to user ${pick.submission.user.username}:`,
          error
        )
      }
    }
  }

  return { awarded, skipped }
}

async function main() {
  console.log("🎯 Awarding opener and closer achievements...")

  // Award PERFECT_OPENER achievement
  const openerResults = await awardAchievement("PERFECT_OPENER", "OPENER")

  // Award PERFECT_CLOSER achievement
  const closerResults = await awardAchievement("PERFECT_CLOSER", "ENCORE")

  console.log(`\n✨ Final Results:`)
  console.log(`\nTakeoff (Perfect Opener):`)
  console.log(`  - Awarded to ${openerResults.awarded} new users`)
  console.log(
    `  - Skipped ${openerResults.skipped} users (already have achievement)`
  )
  console.log(`  - Total: ${openerResults.awarded + openerResults.skipped}`)

  console.log(`\nLanding (Perfect Closer):`)
  console.log(`  - Awarded to ${closerResults.awarded} new users`)
  console.log(
    `  - Skipped ${closerResults.skipped} users (already have achievement)`
  )
  console.log(`  - Total: ${closerResults.awarded + closerResults.skipped}`)

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
