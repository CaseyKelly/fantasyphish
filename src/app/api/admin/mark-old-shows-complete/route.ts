import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { auth } from "@/lib/auth"
import { isAdminFeaturesEnabled } from "@/lib/env"

export async function POST(request: NextRequest) {
  try {
    const session = await auth()

    // Only allow admins
    if (
      !session?.user?.id ||
      !session.user.isAdmin ||
      !isAdminFeaturesEnabled()
    ) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // Get cutoff date from request body, or default to 2025-12-27
    const body = await request.json().catch(() => ({}))
    const cutoffDateStr =
      body.cutoffDate ||
      process.env.MARK_OLD_SHOWS_CUTOFF_DATE ||
      "2025-12-27T00:00:00.000Z"

    const cutoffDate = new Date(cutoffDateStr)

    // Validate the date
    if (isNaN(cutoffDate.getTime())) {
      return NextResponse.json(
        { error: "Invalid cutoff date provided" },
        { status: 400 }
      )
    }

    const result = await prisma.show.updateMany({
      where: {
        showDate: {
          lt: cutoffDate,
        },
        isComplete: false,
      },
      data: {
        isComplete: true,
      },
    })

    // Get remaining incomplete shows
    const remainingIncomplete = await prisma.show.findMany({
      where: {
        isComplete: false,
      },
      orderBy: { showDate: "asc" },
      select: {
        showDate: true,
        venue: true,
        city: true,
        state: true,
      },
    })

    return NextResponse.json({
      message: `Marked ${result.count} shows as complete`,
      updatedCount: result.count,
      remainingIncomplete: remainingIncomplete.map((show) => ({
        date: show.showDate.toISOString().split("T")[0],
        venue: show.venue,
        location: `${show.city}, ${show.state}`,
      })),
    })
  } catch (error) {
    console.error("Error marking old shows complete:", error)
    return NextResponse.json(
      { error: "Failed to mark shows complete" },
      { status: 500 }
    )
  }
}
