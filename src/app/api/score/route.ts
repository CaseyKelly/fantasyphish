import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { getSetlist, isShowComplete, parseSetlist } from "@/lib/phishnet"
import { scoreSubmissionProgressive } from "@/lib/scoring"
import { processPickAchievements } from "@/lib/achievement-awards"
import { withRetry } from "@/lib/db-retry"
import { shouldRunCronJobs } from "@/lib/cron-helpers"

// Force dynamic rendering and disable caching
export const dynamic = "force-dynamic"
export const runtime = "nodejs"

// Grace period after encore detection (60 minutes in milliseconds)
const GRACE_PERIOD_MS = 60 * 60 * 1000

// This endpoint is called by the cron job to score shows progressively
export async function POST(request: Request) {
  const startTime = Date.now()
  console.log(`[Score:POST] ========================================`)
  console.log(`[Score:POST] Cron job started at ${new Date().toISOString()}`)
  console.log(
    `[Score:POST] Request headers: ${JSON.stringify(Object.fromEntries(request.headers.entries()))}`
  )

  try {
    // Verify cron secret (optional to configure, but enforced when CRON_SECRET is set)
    // Vercel cron jobs send "Vercel-Cron" as user-agent and are allowed without CRON_SECRET
    // Manual triggers require the correct CRON_SECRET when it is configured
    const authHeader = request.headers.get("authorization")
    const userAgent = request.headers.get("user-agent")
    const token = authHeader?.replace("Bearer ", "")
    const cronSecret = process.env.CRON_SECRET
    const isVercelCron = userAgent === "Vercel-Cron"

    console.log(
      `[Score:POST] Auth check: cronSecret=${cronSecret ? "SET" : "NOT_SET"}, authHeader=${authHeader ? "PROVIDED" : "MISSING"}, isVercelCron=${isVercelCron}`
    )

    // Allow requests from:
    // 1. Vercel cron (user-agent: "Vercel-Cron")
    // 2. Manual triggers with correct CRON_SECRET
    if (!isVercelCron && cronSecret && token !== cronSecret) {
      console.error(
        "[Score:POST] Unauthorized: not Vercel cron and invalid/missing CRON_SECRET"
      )
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    console.log("[Score:POST] Authorization successful")

    // Check if cron jobs should run (only when tours are active)
    const { shouldRun, reason } = await shouldRunCronJobs()
    if (!shouldRun) {
      console.log(`[Score:POST] Skipping: ${reason}`)
      return NextResponse.json({ skipped: true, reason }, { status: 200 })
    }

    console.log("[Score:POST] Active tours found, proceeding with scoring")

    // Find shows that need scoring:
    // 1. Shows with locked picks (lockTime has passed)
    // 2. Shows that aren't complete yet (isComplete is only set after grace period)
    const showsToScore = await withRetry(
      async () =>
        prisma.show.findMany({
          where: {
            lockTime: { lte: new Date() }, // Only score shows that are locked
            isComplete: false, // Only check incomplete shows (includes grace period)
          },
          include: {
            submissions: {
              include: {
                picks: {
                  include: { song: true },
                },
              },
            },
          },
        }),
      { operationName: "find shows to score" }
    )

    console.log(`[Score:POST] Found ${showsToScore.length} show(s) to check`)

    const results = []

    for (const show of showsToScore) {
      // Extract the date in UTC to avoid timezone conversion
      const showDateStr = show.showDate.toISOString().split("T")[0]
      console.log(
        `[Score:POST] Processing show ${showDateStr} (${show.venue}, ${show.city})`
      )

      // Use noCache to bypass Next.js cache and get fresh setlist data during shows
      const setlist = await getSetlist(showDateStr, { noCache: true })

      // Log the API response
      if (!setlist) {
        console.log(`[Score:POST]   No setlist data returned from API`)
        results.push({
          showId: show.id,
          showDate: showDateStr,
          status: "no_setlist",
          message: "No setlist data available yet",
        })
        continue
      }

      // Log the raw API response for debugging
      console.log(
        `[Score:POST]   API Response: ${JSON.stringify(setlist, null, 2)}`
      )

      // Log parsed songs from setlist
      const parsedSetlist = parseSetlist(setlist)
      console.log(
        `[Score:POST]   ✓ Fetched setlist with ${parsedSetlist.allSongs.length} song(s)`
      )
      console.log(`[Score:POST]   Songs: ${parsedSetlist.allSongs.join(", ")}`)
      console.log(`[Score:POST]   Opener: ${parsedSetlist.opener || "N/A"}`)
      console.log(
        `[Score:POST]   Encore: ${parsedSetlist.encoreSongs.length > 0 ? parsedSetlist.encoreSongs.join(", ") : "N/A"}`
      )

      const encoreDetected = isShowComplete(setlist)
      console.log(`[Score:POST]   Encore detected: ${encoreDetected}`)

      // Count current encore songs
      const currentEncoreCount = encoreDetected
        ? parsedSetlist.encoreSongs.length
        : 0
      console.log(
        `[Score:POST]   Current encore count: ${currentEncoreCount}, Previous: ${show.lastEncoreCount || 0}`
      )

      // Track when encore was first detected
      const encoreJustStarted = encoreDetected && show.encoreStartedAt === null

      // Check if new encore songs were added (reset the timer)
      const newEncoreSongsAdded =
        encoreDetected &&
        show.lastEncoreCount !== null &&
        currentEncoreCount > show.lastEncoreCount

      // Check if we're past the 30-minute grace period
      const gracePeriodExpired =
        show.encoreStartedAt &&
        Date.now() - show.encoreStartedAt.getTime() >= GRACE_PERIOD_MS

      // Only mark as complete after grace period expires
      const showComplete = gracePeriodExpired || false

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

      // Set encoreStartedAt when encore is first detected
      if (encoreJustStarted) {
        updateData.encoreStartedAt = new Date()
        updateData.lastEncoreCount = currentEncoreCount
        console.log(
          `[Score:POST]   ✓ Encore just started - will continue scoring for 60 minutes`
        )
      }

      // Reset timer if new encore songs are added
      if (newEncoreSongsAdded) {
        updateData.encoreStartedAt = new Date()
        updateData.lastEncoreCount = currentEncoreCount
        console.log(
          `[Score:POST]   ✓ New encore song(s) added (${show.lastEncoreCount} → ${currentEncoreCount}) - resetting 60-minute timer`
        )
      }

      // Update encore count even if no new songs (for tracking)
      if (encoreDetected && !encoreJustStarted && !newEncoreSongsAdded) {
        updateData.lastEncoreCount = currentEncoreCount
      }

      if (gracePeriodExpired) {
        console.log(
          `[Score:POST]   ✓ Grace period expired (encore started at ${show.encoreStartedAt!.toISOString()}) - marking show complete`
        )
      } else if (show.encoreStartedAt && encoreDetected) {
        // Log time remaining when encore is detected but grace period hasn't expired
        const elapsedMs = Date.now() - show.encoreStartedAt.getTime()
        const remainingMs = GRACE_PERIOD_MS - elapsedMs
        const remainingMinutes = Math.floor(remainingMs / 60000)
        const remainingSeconds = Math.floor((remainingMs % 60000) / 1000)
        console.log(
          `[Score:POST]   ⏱️  Grace period active - ${remainingMinutes}m ${remainingSeconds}s remaining until show marked complete`
        )
      }

      // Update show with latest setlist data
      await withRetry(
        async () =>
          prisma.show.update({
            where: { id: show.id },
            data: updateData,
          }),
        { operationName: `update show ${show.id}` }
      )

      // Score each submission progressively
      let submissionsProcessed = 0
      let submissionsWithChanges = 0

      for (const submission of show.submissions) {
        const previousSongCount = submission.lastSongCount || 0

        const { scoredPicks, totalPoints, currentSongCount, hasNewSongs } =
          scoreSubmissionProgressive(
            submission.picks,
            setlist,
            previousSongCount
          )

        // Only update if there are new songs or grace period just expired
        if (hasNewSongs || (gracePeriodExpired && !submission.isScored)) {
          // Capture previous wasPlayed values before updating
          const picksWithPrevious = scoredPicks.map((scoredPick) => {
            const existingPick = submission.picks.find(
              (p) => p.id === scoredPick.id
            )
            return {
              ...scoredPick,
              previousWasPlayed: existingPick?.wasPlayed ?? null,
            }
          })

          // Update picks with scores
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

          // Update submission
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

          // Award achievements for newly correct opener/closer picks
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
                `[Score:POST]   🏆 Awarded ${achievementResult.awarded} achievement(s)`
              )
            }
            if (achievementResult.errors > 0) {
              console.log(
                `[Score:POST]   ⚠️  ${achievementResult.errors} achievement error(s)`
              )
            }
          } catch (error) {
            // Log achievement errors but don't fail scoring
            console.error(
              `[Score:POST]   ⚠️  Achievement processing error:`,
              error instanceof Error ? error.message : String(error)
            )
          }

          submissionsWithChanges++
          console.log(
            `[Score:POST]   ✓ Updated submission ${submission.id}: ${previousSongCount} → ${currentSongCount} songs, ${totalPoints} points`
          )
        } else {
          console.log(
            `[Score:POST]   - No changes for submission ${submission.id} (${currentSongCount} songs, ${totalPoints} points)`
          )
        }

        submissionsProcessed++
      }

      console.log(
        `[Score:POST]   ✓ Processed ${submissionsProcessed} submission(s) (${submissionsWithChanges} updated)`
      )

      results.push({
        showId: show.id,
        showDate: showDateStr,
        status: showComplete ? "completed" : "in_progress",
        songCount: parsedSetlist.allSongs.length,
        submissionsProcessed,
        submissionsUpdated: submissionsWithChanges,
        setlist: parsedSetlist,
      })
    }

    const duration = Date.now() - startTime
    console.log(`[Score:POST] ✓ Complete in ${duration}ms`)
    console.log(
      `[Score:POST] Summary: ${results.filter((r) => r.status === "in_progress").length} in progress, ${results.filter((r) => r.status === "completed").length} completed`
    )
    console.log(`[Score:POST] ========================================`)

    return NextResponse.json({
      success: true,
      duration: `${duration}ms`,
      showsProcessed: showsToScore.length,
      results,
    })
  } catch (error) {
    const duration = Date.now() - startTime
    console.error("[Score:POST] ✗ Error scoring shows:", error)
    console.error("[Score:POST] ✗ Error details:", {
      message: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    })
    console.log(`[Score:POST] ========================================`)
    return NextResponse.json(
      {
        error: "Failed to score shows",
        details: error instanceof Error ? error.message : String(error),
        duration: `${duration}ms`,
      },
      { status: 500 }
    )
  } finally {
    await prisma.$disconnect()
  }
}

// GET endpoint - Vercel cron jobs use GET requests
// This is the main entry point for the cron job
export async function GET(request: Request) {
  // Vercel cron makes GET requests, so we handle scoring here
  // Just delegate to POST handler
  return POST(request)
}
