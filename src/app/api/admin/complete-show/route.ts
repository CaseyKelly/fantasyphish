import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { isAdminFeaturesEnabled } from "@/lib/env"
import { getSetlist } from "@/lib/phishnet"
import { scoreShow, showWithSubmissionsInclude } from "@/lib/show-scoring"

export async function POST(request: NextRequest) {
  try {
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

    console.log(`[Admin:CompleteShow] Force-completing show ${showId}`)

    const show = await prisma.show.findUnique({
      where: { id: showId },
      include: showWithSubmissionsInclude,
    })

    if (!show) {
      return NextResponse.json({ error: "Show not found" }, { status: 404 })
    }

    if (show.isComplete) {
      return NextResponse.json(
        { error: "Show is already complete" },
        { status: 400 }
      )
    }

    const showDateStr = show.showDate.toISOString().split("T")[0]
    const setlist = await getSetlist(showDateStr, { noCache: true })

    if (!setlist) {
      return NextResponse.json(
        { error: "No setlist data available yet" },
        { status: 400 }
      )
    }

    const result = await scoreShow(show, setlist, {
      forceComplete: true,
      logPrefix: "[Admin:CompleteShow]",
    })

    console.log(
      `[Admin:CompleteShow] ✓ Show ${showId} marked complete (${result.submissionsUpdated}/${result.submissionsProcessed} submissions finalized)`
    )

    return NextResponse.json({
      success: true,
      ...result,
    })
  } catch (error) {
    console.error("[Admin:CompleteShow] Error completing show:", error)
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Failed to complete show",
      },
      { status: 500 }
    )
  }
}
