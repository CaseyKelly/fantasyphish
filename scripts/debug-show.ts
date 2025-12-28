import { PrismaClient } from "@prisma/client"
import { config } from "dotenv"

config({ path: ".env.local" })
config({ path: ".env" })

const prisma = new PrismaClient()

async function main() {
  // Get the first upcoming show
  const show = await prisma.show.findFirst({
    where: {
      showDate: {
        gte: new Date(),
      },
    },
    orderBy: {
      showDate: "asc",
    },
  })

  if (!show) {
    console.log("No upcoming shows found")
    return
  }

  console.log(
    "DATABASE_URL:",
    process.env.DATABASE_URL?.replace(/:[^:@]+@/, ":****@")
  )
  console.log()
  console.log("Testing show lock logic for:", show.venue)
  console.log("Show date (UTC):", show.showDate.toISOString())
  console.log("Show date (local):", show.showDate.toString())
  console.log()

  // OLD WAY (buggy - uses local timezone)
  const { format } = await import("date-fns")
  const showDateStrOld = format(show.showDate, "yyyy-MM-dd")
  console.log("❌ OLD FORMAT (uses local timezone):", showDateStrOld)

  // NEW WAY (correct - uses UTC)
  const year = show.showDate.getUTCFullYear()
  const month = String(show.showDate.getUTCMonth() + 1).padStart(2, "0")
  const day = String(show.showDate.getUTCDate()).padStart(2, "0")
  const showDateStrNew = `${year}-${month}-${day}`
  console.log("✅ NEW FORMAT (uses UTC):", showDateStrNew)
  console.log()

  // Import the hasShowStarted function
  const { hasShowStarted } = await import("../src/lib/phishnet")

  console.log("Testing with NEW format:")
  const isStartedNew = await hasShowStarted(
    showDateStrNew,
    show.timezone,
    show.state
  )
  console.log("  hasShowStarted result:", isStartedNew)
  console.log()

  console.log("Testing with OLD format (what was causing the bug):")
  const isStartedOld = await hasShowStarted(
    showDateStrOld,
    show.timezone,
    show.state
  )
  console.log("  hasShowStarted result:", isStartedOld)

  await prisma.$disconnect()
}

main()
