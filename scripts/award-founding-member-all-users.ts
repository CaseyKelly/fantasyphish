/**
 * Award Founding Member achievement to all existing users
 *
 * This script is idempotent - safe to run multiple times.
 * It will skip users who already have the achievement.
 *
 * Usage:
 *   npx tsx scripts/award-founding-member-all-users.ts
 *
 * Optional: Award only to users created before a certain date:
 *   npx tsx scripts/award-founding-member-all-users.ts --before="2025-01-01"
 */

import { PrismaClient } from "@prisma/client"
import { config } from "dotenv"
import { ACHIEVEMENT_DEFINITIONS } from "../src/lib/achievements"

// Load environment variables from .env.local
config({ path: ".env.local" })
config({ path: ".env" })

const prisma = new PrismaClient()

async function main() {
  console.log("⭐ Awarding Founding Member achievements to all users...")

  // Parse optional --before argument
  const beforeArg = process.argv.find((arg) => arg.startsWith("--before="))
  const beforeDate = beforeArg
    ? new Date(beforeArg.split("=")[1])
    : new Date("2099-12-31") // Far future date = include all users

  if (beforeArg) {
    console.log(
      `   Filtering users created before: ${beforeDate.toISOString()}`
    )
  }

  const achievementDef = ACHIEVEMENT_DEFINITIONS.FOUNDING_MEMBER

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

  // 2. Find all users created before the cutoff date
  const users = await prisma.user.findMany({
    where: {
      createdAt: {
        lt: beforeDate,
      },
    },
    select: {
      id: true,
      username: true,
      email: true,
      createdAt: true,
    },
    orderBy: {
      createdAt: "asc",
    },
  })

  console.log(`\nFound ${users.length} users to process`)

  if (users.length === 0) {
    console.log("No users found matching criteria")
    return
  }

  // 3. Award achievement to each user (skip if already awarded)
  let awarded = 0
  let skipped = 0
  let errors = 0

  for (const user of users) {
    try {
      await prisma.userAchievement.create({
        data: {
          userId: user.id,
          achievementId: achievement.id,
          metadata: {
            awardedBy: "founding-member-script",
            userCreatedAt: user.createdAt.toISOString(),
          },
        },
      })
      awarded++
      console.log(
        `  ✓ Awarded to ${user.username} (created ${user.createdAt.toLocaleDateString()})`
      )
    } catch (error: unknown) {
      // User already has this achievement (unique constraint violation)
      if (
        error &&
        typeof error === "object" &&
        "code" in error &&
        error.code === "P2002"
      ) {
        skipped++
        console.log(`  ○ Skipped ${user.username} (already has achievement)`)
      } else {
        errors++
        console.error(`  ✗ Error for ${user.username}:`, error)
      }
    }
  }

  console.log(`\n✨ Results:`)
  console.log(`  - Awarded to ${awarded} new users`)
  console.log(`  - Skipped ${skipped} users (already had achievement)`)
  if (errors > 0) {
    console.log(`  - Errors: ${errors}`)
  }
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
