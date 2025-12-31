import { PrismaClient } from "@prisma/client"
import { config } from "dotenv"

config({ path: ".env.local" })
const prisma = new PrismaClient()

async function main() {
  // Check all picks with pickType ENCORE
  const encorePicks = await prisma.pick.findMany({
    where: {
      pickType: "ENCORE",
    },
    include: {
      song: { select: { name: true } },
      submission: {
        include: {
          user: { select: { username: true } },
          show: { select: { showDate: true, venue: true, isComplete: true } },
        },
      },
    },
  })

  console.log(`\nTotal ENCORE picks: ${encorePicks.length}`)

  const played = encorePicks.filter((p) => p.wasPlayed === true)
  const notPlayed = encorePicks.filter((p) => p.wasPlayed === false)
  const notScored = encorePicks.filter((p) => p.wasPlayed === null)

  console.log(`- Correctly picked (wasPlayed=true): ${played.length}`)
  console.log(`- Incorrect (wasPlayed=false): ${notPlayed.length}`)
  console.log(`- Not yet scored (wasPlayed=null): ${notScored.length}`)

  if (played.length > 0) {
    console.log(`\nCorrect encore picks:`)
    played.forEach((p) => {
      console.log(
        `  - ${p.submission.user.username}: ${p.song.name} at ${p.submission.show.venue}`
      )
    })
  }

  if (notScored.length > 0) {
    console.log(`\nUnscored encore picks (shows may not be complete):`)
    notScored.slice(0, 5).forEach((p) => {
      console.log(
        `  - ${p.submission.user.username}: ${p.song.name} at ${p.submission.show.venue} (complete: ${p.submission.show.isComplete})`
      )
    })
  }
}

main().finally(async () => {
  await prisma.$disconnect()
})
