import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { getSetlist } from "@/lib/phishnet"
import { scoreSubmission } from "@/lib/scoring"
import { isAdminFeaturesEnabled } from "@/lib/env"

export async function POST(request: Request) {
  try {
    // Check admin auth
    const session = await auth()
    if (
      !session?.user?.id ||
      !session.user.isAdmin ||
      !isAdminFeaturesEnabled()
    ) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const body = await request.json()
    const { showId, picks } = body

    if (!showId || !picks || !Array.isArray(picks)) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      )
    }

    // Validate picks
    if (picks.length !== 13) {
      return NextResponse.json(
        { error: "Must have exactly 13 picks" },
        { status: 400 }
      )
    }

    // Get the show
    const show = await prisma.show.findUnique({
      where: { id: showId },
    })

    if (!show) {
      return NextResponse.json({ error: "Show not found" }, { status: 404 })
    }

    // Check if test submission already exists for this show
    const existingSubmission = await prisma.submission.findFirst({
      where: {
        showId: show.id,
        userId: session.user.id,
      },
    })

    if (existingSubmission) {
      return NextResponse.json(
        {
          error: "Test submission already exists for this show",
          showId: show.id,
        },
        { status: 400 }
      )
    }

    // Create the test submission
    const submission = await prisma.submission.create({
      data: {
        userId: session.user.id,
        showId: show.id,
        isScored: false,
        picks: {
          create: picks.map((pick) => ({
            songId: pick.songId,
            pickType: pick.pickType,
          })),
        },
      },
      include: {
        picks: {
          include: { song: true },
        },
      },
    })

    console.log(
      `[Admin] Created test submission for ${show.venue} (UTC: ${show.showDate.toISOString().split("T")[0]})`
    )

    // Now score the submission immediately
    try {
      const dateString = show.showDate.toISOString().split("T")[0]
      console.log(
        `[Admin] Fetching setlist for scoring - show.showDate: ${show.showDate.toISOString()}, dateString: ${dateString}`
      )
      const setlist = await getSetlist(dateString)

      if (setlist && setlist.songs) {
        console.log(
          `[Admin] Scoring test submission with ${setlist.songs.length} songs from setlist`
        )

        // Score the submission
        const { scoredPicks, totalPoints } = scoreSubmission(
          submission.picks,
          setlist
        )

        // Save the setlist data to the show for display
        await prisma.show.update({
          where: { id: show.id },
          data: {
            setlistJson: setlist as unknown as object,
            fetchedAt: new Date(),
            lastScoredAt: new Date(),
          },
        })

        // Update each pick with scoring results
        for (const scoredPick of scoredPicks) {
          await prisma.pick.update({
            where: { id: scoredPick.id },
            data: {
              wasPlayed: scoredPick.wasPlayed,
              pointsEarned: scoredPick.pointsEarned,
            },
          })
        }

        // Update submission with total score
        await prisma.submission.update({
          where: { id: submission.id },
          data: {
            isScored: true,
            totalPoints: totalPoints,
          },
        })

        console.log(`[Admin] Test submission scored: ${totalPoints} points`)
      } else {
        console.warn(
          `[Admin] Could not fetch setlist for scoring test submission`
        )
      }
    } catch (scoringError) {
      console.error(`[Admin] Error scoring test submission:`, scoringError)
      // Continue without scoring - the submission exists but isn't scored
    }

    return NextResponse.json({
      success: true,
      message: `Test submission created for ${show.showDate.toISOString().split("T")[0]}`,
      testShow: {
        id: show.id,
        showDate: show.showDate.toISOString().split("T")[0],
        venue: show.venue,
      },
      submission: {
        id: submission.id,
        picks: submission.picks.map((pick) => ({
          song: pick.song.name,
          pickType: pick.pickType,
        })),
      },
    })
  } catch (error) {
    console.error("[Admin] Test submission creation error:", error)
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Test submission creation failed",
      },
      { status: 500 }
    )
  }
}
