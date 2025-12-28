import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { isAdminFeaturesEnabled } from "@/lib/env"
import { Prisma } from "@prisma/client"

export async function POST(request: NextRequest) {
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

    const { showId } = await request.json()

    if (!showId) {
      return NextResponse.json({ error: "showId is required" }, { status: 400 })
    }

    console.log(`[Admin] Resetting show ${showId}`)

    // Get show with submissions
    const show = await prisma.show.findUnique({
      where: { id: showId },
      include: {
        submissions: {
          include: {
            picks: true,
          },
        },
      },
    })

    if (!show) {
      return NextResponse.json({ error: "Show not found" }, { status: 404 })
    }

    // Reset all picks
    for (const submission of show.submissions) {
      await prisma.pick.updateMany({
        where: { submissionId: submission.id },
        data: {
          wasPlayed: null,
          pointsEarned: 0,
        },
      })

      // Reset submission
      await prisma.submission.update({
        where: { id: submission.id },
        data: {
          totalPoints: 0,
          lastSongCount: 0,
          isScored: false,
        },
      })
    }

    // Clear show setlist and status
    await prisma.show.update({
      where: { id: showId },
      data: {
        setlistJson: Prisma.JsonNull,
        lastScoredAt: null,
        isComplete: false,
        fetchedAt: null,
      },
    })

    console.log(
      `[Admin] ✓ Reset ${show.submissions.length} submissions for show ${showId}`
    )

    return NextResponse.json({
      success: true,
      message: "Show reset successfully",
      submissionsReset: show.submissions.length,
    })
  } catch (error) {
    console.error("[Admin] Reset show error:", error)
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Reset failed",
      },
      { status: 500 }
    )
  }
}
