import { PrismaClient } from "@prisma/client"
import dotenv from "dotenv"

// Load environment variables
dotenv.config({ path: ".env.local" })

async function globalSetup() {
  const prisma = new PrismaClient()

  console.log("🧹 Cleaning up test shows from previous runs...")

  try {
    // Delete all shows with "test" in venue or city
    const result = await prisma.show.deleteMany({
      where: {
        OR: [
          { venue: { contains: "test", mode: "insensitive" } },
          { city: { contains: "test", mode: "insensitive" } },
        ],
      },
    })

    console.log(`✓ Deleted ${result.count} test shows`)
  } catch (error) {
    console.error("Error cleaning up test shows:", error)
  } finally {
    await prisma.$disconnect()
  }
}

export default globalSetup
