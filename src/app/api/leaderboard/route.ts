import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const tourId = searchParams.get("tourId")

    // Build the where clause for filtering by tour
    const whereClause = tourId
      ? {
          isScored: true,
          show: {
            tourId,
          },
        }
      : {
          isScored: true,
        }

    // Get all scored submissions grouped by user (exclude admin users)
    const leaderboard = await prisma.user.findMany({
      where: {
        isAdmin: false, // Exclude admin users from leaderboard
        submissions: {
          some: whereClause,
        },
      },
      select: {
        id: true,
        email: true,
        submissions: {
          where: whereClause,
          select: {
            totalPoints: true,
            show: {
              select: {
                showDate: true,
                venue: true,
              },
            },
          },
        },
      },
    })

    // Calculate totals and format for leaderboard
    const rankedUsers = leaderboard
      .map((user) => ({
        userId: user.id,
        email: user.email,
        // Mask email for privacy
        displayName: user.email.split("@")[0].slice(0, 3) + "***",
        totalPoints: user.submissions.reduce(
          (sum, sub) => sum + (sub.totalPoints || 0),
          0
        ),
        showsPlayed: user.submissions.length,
        avgPoints:
          user.submissions.length > 0
            ? Math.round(
                (user.submissions.reduce(
                  (sum, sub) => sum + (sub.totalPoints || 0),
                  0
                ) /
                  user.submissions.length) *
                  10
              ) / 10
            : 0,
      }))
      .sort((a, b) => b.totalPoints - a.totalPoints)
      .map((user, index) => ({
        ...user,
        rank: index + 1,
      }))

    // Get available tours for filtering
    const tours = await prisma.tour.findMany({
      orderBy: { startDate: "desc" },
      select: {
        id: true,
        name: true,
        startDate: true,
        endDate: true,
      },
    })

    return NextResponse.json({
      leaderboard: rankedUsers,
      tours,
    })
  } catch (error) {
    console.error("Error fetching leaderboard:", error)
    return NextResponse.json(
      { error: "Failed to fetch leaderboard" },
      { status: 500 }
    )
  }
}
