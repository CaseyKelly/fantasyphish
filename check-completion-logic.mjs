import { PrismaClient } from "@prisma/client"

const prisma = new PrismaClient()

async function checkCompletionLogic() {
  try {
    const shows = await prisma.show.findMany({
      select: { showDate: true, venue: true, isComplete: true },
      orderBy: { showDate: "desc" },
      take: 10,
    })

    console.log("Current date:", new Date().toISOString())
    console.log("\nShows and their completion status:")

    shows.forEach((show) => {
      const showDate = show.showDate
      const now = new Date()
      const shouldBeComplete = showDate < now
      const dateStr = showDate.toISOString().split("T")[0]

      console.log(`${dateStr} ${show.venue}`)
      console.log(`  Stored isComplete: ${show.isComplete}`)
      console.log(`  Should be complete: ${shouldBeComplete}`)
      console.log(`  Show date: ${showDate}`)
      console.log(`  Now: ${now}`)
      console.log()
    })
  } catch (error) {
    console.error("Error:", error)
  } finally {
    await prisma.$disconnect()
  }
}

checkCompletionLogic()
