import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { getSetlist, isShowComplete, parseSetlist } from "@/lib/phishnet"
import { scoreSubmissionProgressive } from "@/lib/scoring"

// Force dynamic rendering and disable caching
export const dynamic = "force-dynamic"
export const runtime = "nodejs"

// Grace period after encore detection (1 hour in milliseconds)
const GRACE_PERIOD_MS = 60 * 60 * 1000

// This endpoint is called by the cron job to score shows progressively
export async function POST(request: NextRequest) {
  const startTime = Date.now()
  console.log(`[Score:POST] ========================================`)
  console.log(`[Score:POST] Cron job started at ${new Date().toISOString()}`)
  console.log(
    `[Score:POST] Request headers: ${JSON.stringify(Object.fromEntries(request.headers.entries()))}`
  )

  try {
    // Verify cron secret (optional, for security)
    const authHeader = request.headers.get("authorization")
    const cronSecret = process.env.CRON_SECRET

    console.log(
      `[Score:POST] Auth check: cronSecret=${cronSecret ? "SET" : "NOT_SET"}, authHeader=${authHeader ? "PROVIDED" : "MISSING"}`
    )

    if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
      console.log("[Score:POST] ✗ Unauthorized - invalid CRON_SECRET")
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    console.log("[Score:POST] ✓ Authorization successful")

    // Find shows that need scoring:
    // 1. Shows with locked picks (lockTime has passed)
    // 2. Shows that aren't complete yet (isComplete is only set after grace period)
    const showsToScore = await prisma.show.findMany({
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
    })

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

      // Track when encore was first detected
      const encoreJustStarted = encoreDetected && show.encoreStartedAt === null

      // Check if we're past the 1-hour grace period
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
      } = {
        setlistJson: setlist as object,
        isComplete: showComplete,
        fetchedAt: new Date(),
        lastScoredAt: new Date(),
      }

      // Set encoreStartedAt when encore is first detected
      if (encoreJustStarted) {
        updateData.encoreStartedAt = new Date()
        console.log(
          `[Score:POST]   ✓ Encore just started - will continue scoring for 1 hour`
        )
      }

      if (gracePeriodExpired) {
        console.log(
          `[Score:POST]   ✓ Grace period expired (encore started at ${show.encoreStartedAt!.toISOString()}) - marking show complete`
        )
      }

      // Update show with latest setlist data
      await prisma.show.update({
        where: { id: show.id },
        data: updateData,
      })

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
          // Update picks with scores
          for (const scoredPick of scoredPicks) {
            await prisma.pick.update({
              where: { id: scoredPick.id },
              data: {
                wasPlayed: scoredPick.wasPlayed,
                pointsEarned: scoredPick.pointsEarned,
              },
            })
          }

          // Update submission
          // Only mark as fully scored if grace period has expired (1 hour after encore)
          const shouldMarkScored = Boolean(gracePeriodExpired)

          await prisma.submission.update({
            where: { id: submission.id },
            data: {
              isScored: shouldMarkScored,
              totalPoints,
              lastSongCount: currentSongCount,
            },
          })

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
  }
}

// GET endpoint to manually check scoring status
export async function GET() {
  console.log(`[Score:GET] Request started at ${new Date().toISOString()}`)

  try {
    console.log("[Score:GET] Querying for pending shows...")

    const pendingShows = await prisma.show.findMany({
      where: {
        OR: [
          { isComplete: false },
          { submissions: { some: { isScored: false } } },
        ],
      },
      include: {
        _count: {
          select: { submissions: true },
        },
      },
      orderBy: { showDate: "asc" },
    })

    console.log(`[Score:GET] Found ${pendingShows.length} pending show(s)`)

    for (const show of pendingShows) {
      console.log(
        `[Score:GET]   - ${show.showDate.toISOString().split("T")[0]} ${show.venue}: ` +
          `complete=${show.isComplete}, submissions=${show._count.submissions}, ` +
          `lastScored=${show.lastScoredAt?.toISOString() || "never"}`
      )
    }

    const response = {
      pendingShows: pendingShows.map((show) => ({
        id: show.id,
        showDate: show.showDate.toISOString().split("T")[0],
        venue: show.venue,
        isComplete: show.isComplete,
        lockTime: show.lockTime,
        lastScoredAt: show.lastScoredAt,
        submissionCount: show._count.submissions,
      })),
    }

    console.log(`[Score:GET] ✓ Returning ${pendingShows.length} pending shows`)
    return NextResponse.json(response)
  } catch (error) {
    console.error("[Score:GET] ✗ Error checking score status:", error)
    console.error("[Score:GET] ✗ Error details:", {
      message: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    })
    return NextResponse.json(
      { error: "Failed to check score status" },
      { status: 500 }
    )
  }
}
