import { PrismaClient } from "@prisma/client"
import { config } from "dotenv"

config({ path: ".env.local" })
config({ path: ".env" })

const prisma = new PrismaClient()

async function main() {
  const tours = await prisma.tour.findMany({
    orderBy: { startDate: "desc" },
    include: {
      _count: {
        select: {
          shows: true,
        },
      },
    },
  })

  console.log(`\nTotal tours: ${tours.length}\n`)

  for (const tour of tours) {
    const submissionCount = await prisma.submission.count({
      where: { show: { tourId: tour.id } },
    })

    const completedShows = await prisma.show.count({
      where: { tourId: tour.id, isComplete: true },
    })

    const statusEmoji =
      tour.status === "FUTURE"
        ? "🔮"
        : tour.status === "ACTIVE"
          ? "🎸"
          : tour.status === "COMPLETED"
            ? "🏆"
            : "📦"

    console.log(`${statusEmoji} ${tour.name}`)
    console.log(`  Status: ${tour.status}`)
    console.log(
      `  Dates: ${tour.startDate.toISOString().split("T")[0]} - ${tour.endDate?.toISOString().split("T")[0] || "N/A"}`
    )
    console.log(`  Shows: ${tour._count.shows} (${completedShows} complete)`)
    console.log(`  Submissions: ${submissionCount}`)
    console.log(
      `  Will show in history?: ${submissionCount > 0 && tour.status === "CLOSED" ? "YES" : "NO"}`
    )
    console.log()
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
