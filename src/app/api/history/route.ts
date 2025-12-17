import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const submissions = await prisma.submission.findMany({
      where: {
        userId: session.user.id,
      },
      include: {
        show: {
          include: {
            tour: true,
          },
        },
        picks: {
          include: {
            song: true,
          },
          orderBy: {
            pickType: "asc",
          },
        },
      },
      orderBy: {
        show: {
          showDate: "desc",
        },
      },
    });

    // Calculate user's total stats
    const scoredSubmissions = submissions.filter((s) => s.isScored);
    const totalPoints = scoredSubmissions.reduce(
      (sum, s) => sum + (s.totalPoints || 0),
      0
    );
    const totalPicks = scoredSubmissions.length * 13; // 13 picks per submission
    const correctPicks = scoredSubmissions.reduce(
      (sum, s) => sum + s.picks.filter((p) => p.wasPlayed).length,
      0
    );

    return NextResponse.json({
      submissions,
      stats: {
        totalSubmissions: submissions.length,
        scoredSubmissions: scoredSubmissions.length,
        totalPoints,
        avgPoints:
          scoredSubmissions.length > 0
            ? Math.round((totalPoints / scoredSubmissions.length) * 10) / 10
            : 0,
        correctPicks,
        totalPicks,
        accuracy:
          totalPicks > 0 ? Math.round((correctPicks / totalPicks) * 100) : 0,
      },
    });
  } catch (error) {
    console.error("Error fetching history:", error);
    return NextResponse.json(
      { error: "Failed to fetch history" },
      { status: 500 }
    );
  }
}
