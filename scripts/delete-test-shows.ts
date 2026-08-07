import { config } from "dotenv"
import { PrismaClient } from "@prisma/client"
import { PrismaPg } from "@prisma/adapter-pg"

config({ path: ".env.local" })

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL })

const prisma = new PrismaClient({ adapter })

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
