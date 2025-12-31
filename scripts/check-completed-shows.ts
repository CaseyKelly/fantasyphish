import { PrismaClient, Prisma } from "@prisma/client"
import { config } from "dotenv"
import { parseSetlist, type PhishNetSetlist } from "../src/lib/phishnet"

config({ path: ".env.local" })
const prisma = new PrismaClient()

async function main() {
  const completedShows = await prisma.show.findMany({
    where: {
      isComplete: true,
      setlistJson: { not: Prisma.DbNull },
    },
    orderBy: { showDate: "desc" },
  })

  console.log(`\nFound ${completedShows.length} completed shows with setlists`)

  for (const show of completedShows) {
    if (show.setlistJson) {
      const parsed = parseSetlist(
        show.setlistJson as unknown as PhishNetSetlist
      )
      console.log(
        `\n${show.showDate.toISOString().split("T")[0]} - ${show.venue}`
      )
      console.log(`  Opener: ${parsed.opener || "N/A"}`)
      console.log(
        `  Encore: ${parsed.encoreSongs.length > 0 ? parsed.encoreSongs.join(", ") : "N/A"}`
      )
    }
  }
}

main().finally(async () => {
  await prisma.$disconnect()
})
