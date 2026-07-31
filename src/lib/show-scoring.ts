import { Prisma } from "@prisma/client"
import { prisma } from "@/lib/prisma"
import {
  isShowComplete,
  parseSetlist,
  type ParsedSetlist,
  type PhishNetSetlist,
} from "@/lib/phishnet"
import { scoreSubmissionProgressive } from "@/lib/scoring"
import { processPickAchievements } from "@/lib/achievement-awards"
import { withRetry } from "@/lib/db-retry"
import { GRACE_PERIOD_MS } from "@/lib/scoring-constants"

export { GRACE_PERIOD_MS }

export const showWithSubmissionsInclude = {
  submissions: {
    include: {
      picks: {
        include: { song: true },
      },
    },
  },
} satisfies Prisma.ShowInclude

export type ShowWithSubmissions = Prisma.ShowGetPayload<{
  include: typeof showWithSubmissionsInclude
}>

export interface ScoreShowResult {
  status: "completed" | "in_progress"
  songCount: number
  submissionsProcessed: number
  submissionsUpdated: number
  setlist: ParsedSetlist
}

/**
 * Scores every submission for a show against a freshly-fetched setlist and,
 * once the post-encore grace period has expired, finalizes the show
 * (marks submissions fully scored and awards achievements).
 *
 * Shared by the /api/score cron (natural grace-period expiry) and the
 * admin "mark complete" action (options.forceComplete short-circuits the
 * grace period so an admin can finalize a show the moment they see the
 * encore end, without waiting up to 60 minutes).
 */
export async function scoreShow(
  show: ShowWithSubmissions,
  setlist: PhishNetSetlist,
  options: { forceComplete?: boolean; logPrefix?: string } = {}
): Promise<ScoreShowResult> {
  const logPrefix = options.logPrefix ?? "[ScoreShow]"
  const parsedSetlist = parseSetlist(setlist)

  const encoreDetected = isShowComplete(setlist)
  const currentEncoreCount = encoreDetected
    ? parsedSetlist.encoreSongs.length
    : 0

  let gracePeriodExpired: boolean
  let encoreJustStarted = false
  let newEncoreSongsAdded = false

  if (options.forceComplete) {
    gracePeriodExpired = true
    console.log(`${logPrefix}   ✓ Force-completing show (admin override)`)
  } else {
    encoreJustStarted = encoreDetected && show.encoreStartedAt === null
    newEncoreSongsAdded =
      encoreDetected &&
      show.lastEncoreCount !== null &&
      currentEncoreCount > show.lastEncoreCount

    gracePeriodExpired = Boolean(
      show.encoreStartedAt &&
      Date.now() - show.encoreStartedAt.getTime() >= GRACE_PERIOD_MS
    )
  }

  const showComplete = gracePeriodExpired

  const updateData: {
    setlistJson: object
    isComplete: boolean
    fetchedAt: Date
    lastScoredAt: Date
    encoreStartedAt?: Date
    lastEncoreCount?: number
  } = {
    setlistJson: setlist as object,
    isComplete: showComplete,
    fetchedAt: new Date(),
    lastScoredAt: new Date(),
  }

  if (!options.forceComplete) {
    if (encoreJustStarted) {
      updateData.encoreStartedAt = new Date()
      updateData.lastEncoreCount = currentEncoreCount
      console.log(
        `${logPrefix}   ✓ Encore just started - will continue scoring for 60 minutes`
      )
    }

    if (newEncoreSongsAdded) {
      updateData.encoreStartedAt = new Date()
      updateData.lastEncoreCount = currentEncoreCount
      console.log(
        `${logPrefix}   ✓ New encore song(s) added (${show.lastEncoreCount} → ${currentEncoreCount}) - resetting 60-minute timer`
      )
    }

    if (encoreDetected && !encoreJustStarted && !newEncoreSongsAdded) {
      updateData.lastEncoreCount = currentEncoreCount
    }

    if (gracePeriodExpired) {
      console.log(
        `${logPrefix}   ✓ Grace period expired (encore started at ${show.encoreStartedAt!.toISOString()}) - marking show complete`
      )
    } else if (show.encoreStartedAt && encoreDetected) {
      const elapsedMs = Date.now() - show.encoreStartedAt.getTime()
      const remainingMs = GRACE_PERIOD_MS - elapsedMs
      const remainingMinutes = Math.floor(remainingMs / 60000)
      const remainingSeconds = Math.floor((remainingMs % 60000) / 1000)
      console.log(
        `${logPrefix}   ⏱️  Grace period active - ${remainingMinutes}m ${remainingSeconds}s remaining until show marked complete`
      )
    }
  }

  await withRetry(
    async () =>
      prisma.show.update({
        where: { id: show.id },
        data: updateData,
      }),
    { operationName: `update show ${show.id}` }
  )

  let submissionsProcessed = 0
  let submissionsWithChanges = 0

  for (const submission of show.submissions) {
    const previousSongCount = submission.lastSongCount || 0

    const { scoredPicks, totalPoints, currentSongCount, hasNewSongs } =
      scoreSubmissionProgressive(submission.picks, setlist, previousSongCount)

    // Only update if there are new songs or grace period just expired
    if (hasNewSongs || (gracePeriodExpired && !submission.isScored)) {
      const picksWithPrevious = scoredPicks.map((scoredPick) => {
        const existingPick = submission.picks.find(
          (p) => p.id === scoredPick.id
        )
        return {
          ...scoredPick,
          previousWasPlayed: existingPick?.wasPlayed ?? null,
        }
      })

      for (const scoredPick of scoredPicks) {
        await withRetry(
          async () =>
            prisma.pick.update({
              where: { id: scoredPick.id },
              data: {
                wasPlayed: scoredPick.wasPlayed,
                pointsEarned: scoredPick.pointsEarned,
              },
            }),
          { operationName: `update pick ${scoredPick.id}` }
        )
      }

      // Only mark as fully scored if grace period has expired (1 hour after encore)
      const shouldMarkScored = Boolean(gracePeriodExpired)

      await withRetry(
        async () =>
          prisma.submission.update({
            where: { id: submission.id },
            data: {
              isScored: shouldMarkScored,
              totalPoints,
              lastSongCount: currentSongCount,
            },
          }),
        { operationName: `update submission ${submission.id}` }
      )

      try {
        const achievementResult = await processPickAchievements(
          picksWithPrevious,
          {
            userId: submission.userId,
            show: {
              showDate: show.showDate,
              venue: show.venue,
            },
            picks: submission.picks,
          }
        )

        if (achievementResult.awarded > 0) {
          console.log(
            `${logPrefix}   🏆 Awarded ${achievementResult.awarded} achievement(s)`
          )
        }
        if (achievementResult.errors > 0) {
          console.log(
            `${logPrefix}   ⚠️  ${achievementResult.errors} achievement error(s)`
          )
        }
      } catch (error) {
        console.error(
          `${logPrefix}   ⚠️  Achievement processing error:`,
          error instanceof Error ? error.message : String(error)
        )
      }

      submissionsWithChanges++
      console.log(
        `${logPrefix}   ✓ Updated submission ${submission.id}: ${previousSongCount} → ${currentSongCount} songs, ${totalPoints} points`
      )
    } else {
      console.log(
        `${logPrefix}   - No changes for submission ${submission.id} (${currentSongCount} songs, ${totalPoints} points)`
      )
    }

    submissionsProcessed++
  }

  console.log(
    `${logPrefix}   ✓ Processed ${submissionsProcessed} submission(s) (${submissionsWithChanges} updated)`
  )

  return {
    status: showComplete ? "completed" : "in_progress",
    songCount: parsedSetlist.allSongs.length,
    submissionsProcessed,
    submissionsUpdated: submissionsWithChanges,
    setlist: parsedSetlist,
  }
}
