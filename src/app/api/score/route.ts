import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { getSetlist, isShowComplete, parseSetlist } from "@/lib/phishnet"
import { scoreSubmissionProgressive } from "@/lib/scoring"

// This endpoint is called by the cron job to score shows progressively
export async function POST(request: NextRequest) {
  const startTime = Date.now()
  console.log(`[Score] Cron job started at ${new Date().toISOString()}`)

  try {
    // Verify cron secret (optional, for security)
    const authHeader = request.headers.get("authorization")
    const cronSecret = process.env.CRON_SECRET

    if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
      console.log("[Score] ✗ Unauthorized - invalid CRON_SECRET")
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    console.log("[Score] ✓ Authorization successful")

    // Find shows that need scoring:
    // 1. Shows with locked picks (lockTime has passed)
    // 2. Shows that aren't complete yet OR have unscored submissions
    const showsToScore = await prisma.show.findMany({
      where: {
        lockTime: { lte: new Date() }, // Only score shows that are locked
        OR: [
          { isComplete: false }, // Progressive scoring for in-progress shows
          { submissions: { some: { isScored: false } } }, // Final scoring for complete shows
        ],
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

    console.log(`[Score] Found ${showsToScore.length} show(s) to check`)

    const results = []

    for (const show of showsToScore) {
      // Extract the date in UTC to avoid timezone conversion
      const showDateStr = show.showDate.toISOString().split("T")[0]
      console.log(
        `[Score] Processing show ${showDateStr} (${show.venue}, ${show.city})`
      )

      const setlist = await getSetlist(showDateStr)

      // Log the API response
      if (!setlist) {
        console.log(`[Score]   No setlist data returned from API`)
        results.push({
          showId: show.id,
          showDate: showDateStr,
          status: "no_setlist",
          message: "No setlist data available yet",
        })
        continue
      }

      // Log the raw API response for debugging
      console.log(`[Score]   API Response: ${JSON.stringify(setlist, null, 2)}`)

      // Log parsed songs from setlist
      const parsedSetlist = parseSetlist(setlist)
      console.log(
        `[Score]   ✓ Fetched setlist with ${parsedSetlist.allSongs.length} song(s)`
      )
      console.log(`[Score]   Songs: ${parsedSetlist.allSongs.join(", ")}`)
      console.log(`[Score]   Opener: ${parsedSetlist.opener || "N/A"}`)
      console.log(
        `[Score]   Encore: ${parsedSetlist.encoreSongs.length > 0 ? parsedSetlist.encoreSongs.join(", ") : "N/A"}`
      )

      const showComplete = isShowComplete(setlist)
      console.log(`[Score]   Show complete: ${showComplete}`)

      // Update show with latest setlist data
      await prisma.show.update({
        where: { id: show.id },
        data: {
          setlistJson: setlist as object,
          isComplete: showComplete,
          fetchedAt: new Date(),
          lastScoredAt: new Date(),
        },
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

        // Only update if there are new songs or show is newly complete
        if (hasNewSongs || (showComplete && !submission.isScored)) {
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
          await prisma.submission.update({
            where: { id: submission.id },
            data: {
              isScored: showComplete, // Only mark as fully scored when show is complete
              totalPoints,
              lastSongCount: currentSongCount,
            },
          })

          submissionsWithChanges++
          console.log(
            `[Score]   ✓ Updated submission ${submission.id}: ${previousSongCount} → ${currentSongCount} songs, ${totalPoints} points`
          )
        } else {
          console.log(
            `[Score]   - No changes for submission ${submission.id} (${currentSongCount} songs, ${totalPoints} points)`
          )
        }

        submissionsProcessed++
      }

      console.log(
        `[Score]   ✓ Processed ${submissionsProcessed} submission(s) (${submissionsWithChanges} updated)`
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
    console.log(`[Score] ✓ Complete in ${duration}ms`)
    console.log(
      `[Score] Summary: ${results.filter((r) => r.status === "in_progress").length} in progress, ${results.filter((r) => r.status === "completed").length} completed`
    )

    return NextResponse.json({
      success: true,
      duration: `${duration}ms`,
      showsProcessed: showsToScore.length,
      results,
    })
  } catch (error) {
    const duration = Date.now() - startTime
    console.error("[Score] ✗ Error scoring shows:", error)
    console.error("[Score] ✗ Error details:", {
      message: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    })
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
  try {
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

    return NextResponse.json({
      pendingShows: pendingShows.map((show) => ({
        id: show.id,
        showDate: show.showDate.toISOString().split("T")[0],
        venue: show.venue,
        isComplete: show.isComplete,
        lockTime: show.lockTime,
        lastScoredAt: show.lastScoredAt,
        submissionCount: show._count.submissions,
      })),
    })
  } catch (error) {
    console.error("Error checking score status:", error)
    return NextResponse.json(
      { error: "Failed to check score status" },
      { status: 500 }
    )
  }
}
