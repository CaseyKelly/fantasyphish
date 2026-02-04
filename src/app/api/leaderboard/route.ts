import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

export async function GET(request: NextRequest) {
  try {
    // Get the most recent active or completed tour
    const currentTour = await prisma.tour.findFirst({
      where: {
        status: { in: ["ACTIVE", "COMPLETED"] },
      },
      orderBy: { startDate: "desc" },
    })

    // Build where clause for submissions
    const submissionWhere = currentTour
      ? {
          isScored: true,
          show: {
            tourId: currentTour.id,
          },
        }
      : {
          isScored: true,
        }

    // Get all scored submissions (exclude admin users)
    const leaderboard = await prisma.user.findMany({
      where: {
        isAdmin: false, // Exclude admin users from leaderboard
        submissions: {
          some: submissionWhere,
        },
      },
      select: {
        id: true,
        username: true,
        email: true,
        submissions: {
          where: submissionWhere,
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
        username: user.username,
        email: user.email,
        // Use username, no masking
        displayName: user.username,
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

    return NextResponse.json({
      leaderboard: rankedUsers,
      currentTour: currentTour
        ? {
            id: currentTour.id,
            name: currentTour.name,
            startDate: currentTour.startDate,
            endDate: currentTour.endDate,
          }
        : null,
    })
  } catch (error) {
    console.error("Error fetching leaderboard:", error)
    return NextResponse.json(
      { error: "Failed to fetch leaderboard" },
      { status: 500 }
    )
  }
}
