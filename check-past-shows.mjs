import { PrismaClient } from "@prisma/client"

const prisma = new PrismaClient()

async function findPastShows() {
  try {
    const shows = await prisma.show.findMany({
      where: {
        isComplete: true,
        showDate: { lt: new Date() }, // Shows that have actually happened
      },
      select: { showDate: true, venue: true, city: true },
      orderBy: { showDate: "desc" },
      take: 10,
    })

    console.log("Past completed shows:", shows.length)
    shows.forEach((s) => {
      const dateStr = s.showDate.toISOString().split("T")[0]
      console.log(`${dateStr} - ${s.venue} (${s.city})`)
    })

    if (shows.length === 0) {
      console.log(
        "No past completed shows found - all shows are in the future!"
      )

      // Check if there are any past shows at all (regardless of isComplete flag)
      const anyPastShows = await prisma.show.findMany({
        where: {
          showDate: { lt: new Date() },
        },
        select: { showDate: true, venue: true, isComplete: true },
        orderBy: { showDate: "desc" },
        take: 5,
      })

      console.log(
        `Found ${anyPastShows.length} past shows (regardless of isComplete):`
      )
      anyPastShows.forEach((s) => {
        const dateStr = s.showDate.toISOString().split("T")[0]
        console.log(`${dateStr} - ${s.venue} (isComplete: ${s.isComplete})`)
      })
    }
  } catch (error) {
    console.error("Error:", error)
  } finally {
    await prisma.$disconnect()
  }
}

findPastShows()
