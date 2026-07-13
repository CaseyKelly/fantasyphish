import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { hasShowStarted } from "@/lib/phishnet"
import { withRetry } from "@/lib/db-retry"

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ showId: string }> }
) {
  try {
    const { showId } = await params

    const show = await withRetry(
      () =>
        prisma.show.findUnique({
          where: { id: showId },
          include: {
            tour: true,
          },
        }),
      { operationName: "find show" }
    )

    if (!show) {
      return NextResponse.json({ error: "Show not found" }, { status: 404 })
    }

    // Check if show has started
    // Extract the date in UTC to avoid timezone conversion
    const showDateStr = show.showDate.toISOString().split("T")[0]
    const isLocked = await hasShowStarted(
      showDateStr,
      show.timezone,
      show.state
    )

    return NextResponse.json({
      show: {
        ...show,
        isLocked,
      },
    })
  } catch (error) {
    console.error("Error fetching show:", error)
    return NextResponse.json({ error: "Failed to fetch show" }, { status: 500 })
  }
}
