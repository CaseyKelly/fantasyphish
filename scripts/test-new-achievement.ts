import { PrismaClient } from "@prisma/client"
import { PrismaPg } from "@prisma/adapter-pg"
import { config } from "dotenv"

config({ path: ".env.local" })
const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL })
const prisma = new PrismaClient({ adapter })

async function main() {
  console.log("Looking for users with correct picks but no achievements...\n")

  // Find all correct opener picks
  const openerPicks = await prisma.pick.findMany({
    where: {
      pickType: "OPENER",
      wasPlayed: true,
    },
    include: {
      submission: {
        include: {
          user: true,
        },
      },
      song: { select: { name: true } },
    },
  })

  console.log(`Found ${openerPicks.length} correct opener picks\n`)

  for (const pick of openerPicks) {
    // Check if user has achievement
    const userAchievements = await prisma.userAchievement.findMany({
      where: {
        userId: pick.submission.user.id,
      },
      include: {
        achievement: true,
      },
    })

    const hasOpenerAchievement = userAchievements.some(
      (ua) => ua.achievement.slug === "perfect-opener"
    )
    console.log(
      `${pick.submission.user.username}: ${pick.song.name} - ${hasOpenerAchievement ? "✓ Has achievement" : "✗ Missing achievement"}`
    )
  }
}

main()
  .catch((error) => {
    console.error("Error:", error)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
