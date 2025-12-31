import { PrismaClient } from "@prisma/client"
import { config } from "dotenv"

config({ path: ".env.local" })
const prisma = new PrismaClient()

async function main() {
  const users = await prisma.user.findMany({
    where: {
      OR: [
        { username: "chalupa" },
        { username: "LandofLizards" },
        { username: "Rookiewookie" },
      ],
    },
    include: {
      achievements: {
        include: { achievement: true },
      },
    },
  })

  for (const user of users) {
    console.log(`\n${user.username}:`)
    user.achievements.forEach((ua) => {
      console.log(`  - ${ua.achievement.name} (${ua.achievement.icon})`)
    })
  }
}

main().finally(async () => {
  await prisma.$disconnect()
})
