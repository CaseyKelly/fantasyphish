/**
 * Repair submissions stranded by an interrupted final scoring pass.
 *
 * Before the fix in src/lib/show-scoring.ts, scoreShow marked a show
 * isComplete before finalizing its submissions. If the run was cut off
 * mid-loop (e.g. a function timeout), the scoring cron never revisited the
 * show, leaving some submissions with isScored = false forever. Those drop
 * out of tour leaderboards and profile stats.
 *
 * This rescores each stranded submission against the setlist already stored
 * on its show and marks it scored. Achievements are left to the daily
 * /api/award-achievements cron, which scans every correct pick.
 *
 * Usage:
 *   npx tsx scripts/repair-stranded-submissions.ts          # dry run
 *   npx tsx scripts/repair-stranded-submissions.ts --apply  # write changes
 */
import { PrismaClient } from "@prisma/client"
import { PrismaPg } from "@prisma/adapter-pg"
import { config } from "dotenv"
import { parseSetlist, type PhishNetSetlist } from "../src/lib/phishnet"
import { scoreSubmission } from "../src/lib/scoring"

config({ path: ".env.local" })
const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL })
const prisma = new PrismaClient({ adapter })

async function main(): Promise<void> {
  const apply = process.argv.includes("--apply")
  console.log(
    apply ? "\n✍️  APPLY mode" : "\n🔍 DRY RUN (pass --apply to write)"
  )

  const stranded = await prisma.submission.findMany({
    where: {
      isScored: false,
      show: { isComplete: true },
    },
    include: {
      user: { select: { username: true } },
      show: {
        select: { showDate: true, venue: true, setlistJson: true },
      },
      picks: { include: { song: true } },
    },
    orderBy: [{ show: { showDate: "asc" } }, { createdAt: "asc" }],
  })

  console.log(`Found ${stranded.length} stranded submission(s)\n`)

  let repaired = 0
  let skipped = 0
  let pointsChanged = 0

  for (const submission of stranded) {
    const showDate = submission.show.showDate.toISOString().split("T")[0]
    const label = `${showDate} ${submission.show.venue} - ${submission.user.username}`

    if (!submission.show.setlistJson) {
      console.log(`  ⚠️  ${label}: show has no stored setlist, skipping`)
      skipped++
      continue
    }

    const setlist = submission.show.setlistJson as unknown as PhishNetSetlist
    const { scoredPicks, totalPoints } = scoreSubmission(
      submission.picks,
      setlist
    )
    const songCount = parseSetlist(setlist).allSongs.length

    const before = submission.totalPoints ?? 0
    const delta = totalPoints - before
    if (delta !== 0) pointsChanged++
    console.log(
      `  ${label}: ${before} → ${totalPoints} pts${delta !== 0 ? ` (${delta > 0 ? "+" : ""}${delta})` : ""}`
    )

    if (apply) {
      await prisma.$transaction([
        ...scoredPicks.map((scoredPick) =>
          prisma.pick.update({
            where: { id: scoredPick.id },
            data: {
              wasPlayed: scoredPick.wasPlayed,
              pointsEarned: scoredPick.pointsEarned,
            },
          })
        ),
        prisma.submission.update({
          where: { id: submission.id },
          data: {
            isScored: true,
            totalPoints,
            lastSongCount: songCount,
          },
        }),
      ])
    }
    repaired++
  }

  console.log(
    `\n${apply ? "Repaired" : "Would repair"} ${repaired} submission(s), ${pointsChanged} with a points change; skipped ${skipped}`
  )
}

main()
  .catch((error) => {
    console.error(error)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
