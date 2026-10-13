/**
 * Award the Fee-dback achievement to users who emailed Chalupa
 * (chalupa@fantasyphish.com) with an idea to make the site better.
 *
 * This script is idempotent - safe to run multiple times.
 *
 * Usage: npx tsx scripts/award-fee-dback.ts <username> [username...]
 */

import { PrismaClient } from "@prisma/client"
import { PrismaPg } from "@prisma/adapter-pg"
import { config } from "dotenv"
import { ACHIEVEMENT_DEFINITIONS } from "../src/lib/achievements"

// Load environment variables from .env.local
config({ path: ".env.local" })
config({ path: ".env" })

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL })

const prisma = new PrismaClient({ adapter })

async function main() {
  const usernames = process.argv.slice(2)

  if (usernames.length === 0) {
    console.error(
      "Usage: npx tsx scripts/award-fee-dback.ts <username> [username...]"
    )
    process.exit(1)
  }

  const achievementDef = ACHIEVEMENT_DEFINITIONS.FEE_DBACK

  // Create or get the achievement record
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

  let failed = false

  for (const username of usernames) {
    const user = await prisma.user.findFirst({
      where: { username: { equals: username, mode: "insensitive" } },
    })

    if (!user) {
      console.error(`❌ User not found: ${username}`)
      failed = true
      continue
    }

    try {
      await prisma.userAchievement.create({
        data: {
          userId: user.id,
          achievementId: achievement.id,
          metadata: {
            awardedBy: "script",
            awardedAt: new Date().toISOString(),
          },
        },
      })
      console.log(`✨ ${achievement.name} awarded to ${user.username}`)
    } catch (error: unknown) {
      if (
        error &&
        typeof error === "object" &&
        "code" in error &&
        error.code === "P2002"
      ) {
        console.log(`✓ ${user.username} already has this achievement`)
      } else {
        console.error(`❌ Error awarding to ${user.username}:`, error)
        failed = true
      }
    }
  }

  if (failed) process.exit(1)
}

main()
  .catch((error) => {
    console.error("Error running script:", error)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
