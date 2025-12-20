import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { getSetlist } from "@/lib/phishnet"
import { scoreSubmission } from "@/lib/scoring"
import { format } from "date-fns"

export async function POST(request: NextRequest) {
  try {
    // Check admin auth
    const session = await auth()
    if (!session?.user?.id || !session.user.isAdmin) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { showId } = await request.json()

    if (!showId) {
      return NextResponse.json({ error: "showId is required" }, { status: 400 })
    }

    console.log(`[Admin] Test scoring for show ${showId}`)

    // Get show with submissions
    const show = await prisma.show.findUnique({
      where: { id: showId },
      include: {
        submissions: {
          where: { userId: session.user.id }, // Only get admin's test submission
          include: {
            picks: { include: { song: true } },
          },
        },
      },
    })

    if (!show) {
      return NextResponse.json({ error: "Show not found" }, { status: 404 })
    }

    if (show.submissions.length === 0) {
      return NextResponse.json(
        { error: "No test submission found for this show" },
        { status: 400 }
      )
    }

    // Get the actual setlist from phish.net for this date
    const showDateStr = format(show.showDate, "yyyy-MM-dd")
    const setlist = await getSetlist(showDateStr)

    if (!setlist || !setlist.songs || setlist.songs.length === 0) {
      return NextResponse.json(
        { error: `No setlist found for ${showDateStr}` },
        { status: 400 }
      )
    }

    console.log(
      `[Admin] Applying real setlist with ${setlist.songs.length} songs`
    )

    // Update show with setlist
    await prisma.show.update({
      where: { id: showId },
      data: {
        setlistJson: setlist as unknown as object,
        isComplete: true,
        fetchedAt: new Date(),
      },
    })

    // Score the test submission
    const submission = show.submissions[0]
    const { scoredPicks, totalPoints } = scoreSubmission(
      submission.picks.map((pick) => ({
        id: pick.id,
        pickType: pick.pickType,
        song: {
          name: pick.song.name,
          slug: pick.song.slug,
        },
      })),
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
        totalPoints,
        isScored: true,
      },
    })

    console.log(
      `[Admin] ✓ Test scored submission for show ${showId} with ${totalPoints} points`
    )

    return NextResponse.json({
      success: true,
      message: `Test scoring complete: ${totalPoints} points`,
      testResults: {
        showDate: showDateStr,
        venue: show.venue,
        songCount: setlist.songs.length,
        totalPoints,
        scoredPicks: scoredPicks.map((pick) => {
          const originalPick = submission.picks.find((p) => p.id === pick.id)
          return {
            song: originalPick?.song.name,
            pickType: originalPick?.pickType,
            wasPlayed: pick.wasPlayed,
            pointsEarned: pick.pointsEarned,
          }
        }),
      },
    })
  } catch (error) {
    console.error("[Admin] Test scoring error:", error)
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Test scoring failed",
      },
      { status: 500 }
    )
  }
}
