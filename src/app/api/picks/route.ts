import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { hasShowStarted } from "@/lib/phishnet"
import { format } from "date-fns"
import { z } from "zod"
import { PickType } from "@prisma/client"

const submitPicksSchema = z.object({
  showId: z.string(),
  picks: z.array(
    z.object({
      songId: z.string(),
      pickType: z.enum(["OPENER", "ENCORE", "REGULAR"]),
    })
  ),
})

// GET - Get user's submission for a show
export async function GET(request: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const showId = searchParams.get("showId")

    if (!showId) {
      return NextResponse.json({ error: "showId is required" }, { status: 400 })
    }

    const submission = await prisma.submission.findUnique({
      where: {
        userId_showId: {
          userId: session.user.id,
          showId,
        },
      },
      include: {
        picks: {
          include: {
            song: true,
          },
        },
        show: true,
      },
    })

    return NextResponse.json({ submission })
  } catch (error) {
    console.error("Error fetching picks:", error)
    return NextResponse.json(
      { error: "Failed to fetch picks" },
      { status: 500 }
    )
  }
}

// POST - Submit picks for a show
export async function POST(request: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const body = await request.json()
    const { showId, picks } = submitPicksSchema.parse(body)

    // Validate pick count
    const openerPicks = picks.filter((p) => p.pickType === "OPENER")
    const encorePicks = picks.filter((p) => p.pickType === "ENCORE")
    const regularPicks = picks.filter((p) => p.pickType === "REGULAR")

    if (openerPicks.length !== 1) {
      return NextResponse.json(
        { error: "You must select exactly 1 opener" },
        { status: 400 }
      )
    }

    if (encorePicks.length !== 1) {
      return NextResponse.json(
        { error: "You must select exactly 1 encore" },
        { status: 400 }
      )
    }

    if (regularPicks.length !== 11) {
      return NextResponse.json(
        { error: "You must select exactly 11 regular songs" },
        { status: 400 }
      )
    }

    // Check for duplicate songs
    const songIds = picks.map((p) => p.songId)
    if (new Set(songIds).size !== songIds.length) {
      return NextResponse.json(
        { error: "You cannot pick the same song twice" },
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

    // Check if show has started
    const showDateStr = format(show.showDate, "yyyy-MM-dd")
    const showStarted = await hasShowStarted(showDateStr)

    if (showStarted) {
      return NextResponse.json(
        { error: "This show has already started. Submissions are locked." },
        { status: 400 }
      )
    }

    // Check if user already has a submission for this show
    const existingSubmission = await prisma.submission.findUnique({
      where: {
        userId_showId: {
          userId: session.user.id,
          showId,
        },
      },
    })

    if (existingSubmission) {
      // Update existing submission
      await prisma.pick.deleteMany({
        where: { submissionId: existingSubmission.id },
      })

      await prisma.pick.createMany({
        data: picks.map((pick) => ({
          submissionId: existingSubmission.id,
          songId: pick.songId,
          pickType: pick.pickType as PickType,
        })),
      })

      const updatedSubmission = await prisma.submission.findUnique({
        where: { id: existingSubmission.id },
        include: {
          picks: {
            include: { song: true },
          },
          show: true,
        },
      })

      return NextResponse.json({
        success: true,
        submission: updatedSubmission,
        message: "Picks updated successfully!",
      })
    }

    // Create new submission
    const submission = await prisma.submission.create({
      data: {
        userId: session.user.id,
        showId,
        picks: {
          create: picks.map((pick) => ({
            songId: pick.songId,
            pickType: pick.pickType as PickType,
          })),
        },
      },
      include: {
        picks: {
          include: { song: true },
        },
        show: true,
      },
    })

    return NextResponse.json({
      success: true,
      submission,
      message: "Picks submitted successfully!",
    })
  } catch (error) {
    console.error("Error submitting picks:", error)

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: error.issues[0].message },
        { status: 400 }
      )
    }

    return NextResponse.json(
      { error: "Failed to submit picks" },
      { status: 500 }
    )
  }
}
