/**
 * Award Founding Member achievement to a specific user
 *
 * This script is idempotent - safe to run multiple times.
 *
 * Usage: npx tsx scripts/award-founding-member.ts [username]
 */

import { PrismaClient } from "@prisma/client"
import { config } from "dotenv"
import { ACHIEVEMENT_DEFINITIONS } from "../src/lib/achievements"

// Load environment variables from .env.local
config({ path: ".env.local" })
config({ path: ".env" })

const prisma = new PrismaClient()

async function main() {
  const username = process.argv[2] || "chalupa"

  console.log(`⭐ Awarding Founding Member achievement to: ${username}`)

  // Find the user
  const user = await prisma.user.findUnique({
    where: { username },
  })

  if (!user) {
    console.error(`❌ User not found: ${username}`)
    process.exit(1)
  }

  console.log(`✓ Found user: ${user.username} (${user.email})`)

  const achievementDef = ACHIEVEMENT_DEFINITIONS.FOUNDING_MEMBER

  // Create or get the achievement record
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

  // Award achievement to the user
  try {
    const userAchievement = await prisma.userAchievement.create({
      data: {
        userId: user.id,
        achievementId: achievement.id,
        metadata: {
          awardedBy: "script",
          awardedAt: new Date().toISOString(),
        },
      },
    })

    console.log(`\n✨ Success!`)
    console.log(
      `   ${achievement.icon} ${achievement.name} awarded to ${user.username}`
    )
    console.log(`   Earned at: ${userAchievement.earnedAt.toISOString()}`)
  } catch (error: unknown) {
    if (
      error &&
      typeof error === "object" &&
      "code" in error &&
      error.code === "P2002"
    ) {
      console.log(`\n✓ User already has this achievement`)
    } else {
      console.error(`\n❌ Error awarding achievement:`, error)
      throw error
    }
  }
}

main()
  .catch((error) => {
    console.error("Error running script:", error)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
