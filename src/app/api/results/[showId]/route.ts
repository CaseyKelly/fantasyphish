import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import type { PhishNetSetlist } from "@/lib/phishnet"

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ showId: string }> }
) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { showId } = await params
    const { searchParams } = new URL(request.url)
    const submissionId = searchParams.get("submissionId")

    // Get show with submission(s)
    const show = await prisma.show.findUnique({
      where: { id: showId },
      include: {
        submissions: {
          where: submissionId
            ? { id: submissionId } // Admin viewing specific submission
            : { userId: session.user.id }, // User viewing their own
          include: {
            picks: {
              include: { song: true },
              orderBy: [{ pickType: "asc" }, { song: { name: "asc" } }],
            },
            user: {
              // Include user info for admin context
              select: { username: true },
            },
          },
        },
      },
    })

    if (!show) {
      return NextResponse.json({ error: "Show not found" }, { status: 404 })
    }

    // Hide test shows from non-admin users
    const isTestShow = show.venue.includes("Test Venue")
    if (isTestShow && !session.user.isAdmin) {
      return NextResponse.json({ error: "Show not found" }, { status: 404 })
    }

    const submission = show.submissions[0]

    if (!submission) {
      return NextResponse.json(
        { error: "No submission found for this show" },
        { status: 404 }
      )
    }

    // Return setlist in format expected by component
    let setlistData = null
    if (show.setlistJson) {
      const rawSetlist = show.setlistJson as unknown as PhishNetSetlist
      // Convert to format expected by React component
      setlistData = {
        songs: rawSetlist.songs.map((song) => ({
          song: song.song,
          set: song.set,
          position: song.position,
        })),
      }
    }

    return NextResponse.json({
      show: {
        id: show.id,
        venue: show.venue,
        city: show.city,
        state: show.state,
        showDate: show.showDate,
        isComplete: show.isComplete,
        lockTime: show.lockTime,
        lastScoredAt: show.lastScoredAt,
      },
      submission: {
        id: submission.id,
        totalPoints: submission.totalPoints,
        isScored: submission.isScored,
        username: submission.user.username, // Include username for admin context
        picks: submission.picks.map((pick) => ({
          id: pick.id,
          song: pick.song.name,
          pickType: pick.pickType,
          wasPlayed: pick.wasPlayed,
          pointsEarned: pick.pointsEarned,
        })),
      },
      setlist: setlistData,
    })
  } catch (error) {
    console.error("Error fetching results:", error)
    return NextResponse.json(
      { error: "Failed to fetch results" },
      { status: 500 }
    )
  }
}
