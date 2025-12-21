import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { getSetlist, isShowComplete, parseSetlist } from "@/lib/phishnet"
import { scoreSubmission } from "@/lib/scoring"
import { format } from "date-fns"

// This endpoint is called by the cron job to score completed shows
export async function POST(request: NextRequest) {
  try {
    // Verify cron secret (required in production)
    const authHeader = request.headers.get("authorization")
    const cronSecret = process.env.CRON_SECRET

    // In production, CRON_SECRET is mandatory
    if (process.env.NODE_ENV === "production" && !cronSecret) {
      console.error("CRON_SECRET not configured in production environment")
      return NextResponse.json(
        { error: "Server configuration error" },
        { status: 500 }
      )
    }

    if (authHeader !== `Bearer ${cronSecret}`) {
      console.warn("Unauthorized cron job attempt", {
        hasAuth: !!authHeader,
        timestamp: new Date().toISOString(),
      })
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // Find shows that need scoring (have submissions but aren't scored yet)
    const showsToScore = await prisma.show.findMany({
      where: {
        isComplete: false,
        submissions: {
          some: {
            isScored: false,
          },
        },
      },
      include: {
        submissions: {
          where: { isScored: false },
          include: {
            picks: {
              include: { song: true },
            },
          },
        },
      },
    })

    const results = []

    for (const show of showsToScore) {
      const showDateStr = format(show.showDate, "yyyy-MM-dd")
      const setlist = await getSetlist(showDateStr)

      if (!setlist || !isShowComplete(setlist)) {
        results.push({
          showId: show.id,
          showDate: showDateStr,
          status: "not_complete",
          message: "Show setlist not complete yet",
        })
        continue
      }

      // Update show with setlist data
      await prisma.show.update({
        where: { id: show.id },
        data: {
          setlistJson: setlist as object,
          isComplete: true,
          fetchedAt: new Date(),
        },
      })

      // Score each submission
      for (const submission of show.submissions) {
        const { scoredPicks, totalPoints } = scoreSubmission(
          submission.picks,
          setlist
        )

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
            isScored: true,
            totalPoints,
          },
        })
      }

      results.push({
        showId: show.id,
        showDate: showDateStr,
        status: "scored",
        submissionsScored: show.submissions.length,
        setlist: parseSetlist(setlist),
      })
    }

    return NextResponse.json({
      success: true,
      showsProcessed: showsToScore.length,
      results,
    })
  } catch (error) {
    console.error("Error scoring shows:", error)
    return NextResponse.json(
      { error: "Failed to score shows" },
      { status: 500 }
    )
  }
}

// GET endpoint to manually check scoring status
export async function GET() {
  try {
    const pendingShows = await prisma.show.findMany({
      where: {
        submissions: {
          some: {
            isScored: false,
          },
        },
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
        showDate: format(show.showDate, "yyyy-MM-dd"),
        venue: show.venue,
        isComplete: show.isComplete,
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
