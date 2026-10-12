import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { hasShowStarted } from "@/lib/phishnet"
import { z } from "zod"
import { PickType } from "@prisma/client"
import { withRetry } from "@/lib/db-retry"
import { validatePicks } from "@/lib/pick-rules"
import { submitPicksSchema } from "./schema"

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

    const submission = await withRetry(
      () =>
        prisma.submission.findUnique({
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
        }),
      { operationName: "find submission" }
    )

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

    // Get the show with tour information
    const show = await withRetry(
      () =>
        prisma.show.findUnique({
          where: { id: showId },
          include: { tour: true },
        }),
      { operationName: "find show for picks" }
    )

    if (!show) {
      return NextResponse.json({ error: "Show not found" }, { status: 404 })
    }

    // Validate pick composition (one opener per set, 1 encore, the rest regular)
    const pickError = validatePicks(picks, show.setCount)
    if (pickError) {
      return NextResponse.json({ error: pickError }, { status: 400 })
    }

    // Check if show has started (now timezone-aware)
    // Extract the date in UTC to avoid timezone conversion
    const showDateStr = show.showDate.toISOString().split("T")[0]
    const showStarted = await hasShowStarted(
      showDateStr,
      show.timezone,
      show.state
    )

    if (showStarted) {
      return NextResponse.json(
        { error: "This show has already started. Submissions are locked." },
        { status: 400 }
      )
    }

    // Calculate and store lock time if not set
    if (!show.lockTime && (show.timezone || show.state)) {
      const { getTimezoneForLocation, getShowLockTime } =
        await import("@/lib/timezone")
      const tz = show.timezone || getTimezoneForLocation(show.state)
      const lockTime = getShowLockTime(show.showDate, tz)

      await withRetry(
        () =>
          prisma.show.update({
            where: { id: show.id },
            data: { lockTime, timezone: tz },
          }),
        { operationName: "update show lock time" }
      )
    }

    // Check if user already has a submission for this show
    const existingSubmission = await withRetry(
      () =>
        prisma.submission.findUnique({
          where: {
            userId_showId: {
              userId: session.user.id,
              showId,
            },
          },
        }),
      { operationName: "find existing submission" }
    )

    if (existingSubmission) {
      // Update existing submission
      await withRetry(
        () =>
          prisma.pick.deleteMany({
            where: { submissionId: existingSubmission.id },
          }),
        { operationName: "delete existing picks" }
      )

      await withRetry(
        () =>
          prisma.pick.createMany({
            data: picks.map((pick) => ({
              submissionId: existingSubmission.id,
              songId: pick.songId,
              pickType: pick.pickType as PickType,
              openerSet:
                pick.pickType === "OPENER" ? (pick.openerSet ?? 1) : null,
            })),
          }),
        { operationName: "create picks" }
      )

      const updatedSubmission = await withRetry(
        () =>
          prisma.submission.findUnique({
            where: { id: existingSubmission.id },
            include: {
              picks: {
                include: { song: true },
              },
              show: true,
            },
          }),
        { operationName: "find updated submission" }
      )

      return NextResponse.json({
        success: true,
        submission: updatedSubmission,
        message: "Picks updated successfully!",
      })
    }

    // Create new submission
    const submission = await withRetry(
      () =>
        prisma.submission.create({
          data: {
            userId: session.user.id,
            showId,
            picks: {
              create: picks.map((pick) => ({
                songId: pick.songId,
                pickType: pick.pickType as PickType,
                openerSet:
                  pick.pickType === "OPENER" ? (pick.openerSet ?? 1) : null,
              })),
            },
          },
          include: {
            picks: {
              include: { song: true },
            },
            show: true,
          },
        }),
      { operationName: "create submission" }
    )

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
