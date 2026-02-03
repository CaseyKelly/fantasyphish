import { config } from "dotenv"
import { PrismaClient } from "@prisma/client"

config({ path: ".env.local" })

const prisma = new PrismaClient()

async function deleteTestShows() {
  // Delete all shows with "test" in venue or city
  const result = await prisma.show.deleteMany({
    where: {
      OR: [
        { venue: { contains: "test", mode: "insensitive" } },
        { city: { contains: "test", mode: "insensitive" } },
      ],
    },
  })

  console.log(`Deleted ${result.count} test shows`)

  await prisma.$disconnect()
}

deleteTestShows().catch(console.error)
