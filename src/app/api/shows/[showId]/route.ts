import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { hasShowStarted } from "@/lib/phishnet"
import { format } from "date-fns"

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ showId: string }> }
) {
  try {
    const { showId } = await params

    const show = await prisma.show.findUnique({
      where: { id: showId },
      include: {
        tour: true,
      },
    })

    if (!show) {
      return NextResponse.json({ error: "Show not found" }, { status: 404 })
    }

    // Check if show has started
    const showDateStr = format(show.showDate, "yyyy-MM-dd")
    const isLocked = await hasShowStarted(showDateStr)

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
