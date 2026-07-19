import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { withRetry } from "@/lib/db-retry"
import { z } from "zod"

const LEADERBOARD_SIZE = 10

const submitScoreSchema = z.object({
  score: z.number().int().min(0).max(100_000),
})

// GET - Top Donut Catch scores, plus the current user's personal best
export async function GET() {
  try {
    const session = await auth()

    const topScores = await withRetry(
      () =>
        prisma.easterEggScore.findMany({
          orderBy: { score: "desc" },
          take: LEADERBOARD_SIZE,
          select: {
            score: true,
            user: { select: { username: true } },
          },
        }),
      { operationName: "find easter egg leaderboard" }
    )

    let yourBest: number | null = null
    if (session?.user?.id) {
      const mine = await withRetry(
        () =>
          prisma.easterEggScore.findUnique({
            where: { userId: session.user.id },
            select: { score: true },
          }),
        { operationName: "find your easter egg score" }
      )
      yourBest = mine?.score ?? null
    }

    return NextResponse.json({
      leaderboard: topScores.map((entry) => ({
        username: entry.user.username,
        score: entry.score,
      })),
      yourBest,
    })
  } catch (error) {
    console.error("Error fetching easter egg leaderboard:", error)
    return NextResponse.json(
      { error: "Failed to fetch leaderboard" },
      { status: 500 }
    )
  }
}

// POST - Submit a Donut Catch score (only kept if it beats your personal best)
export async function POST(request: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const body = await request.json()
    const { score } = submitScoreSchema.parse(body)

    const existing = await withRetry(
      () =>
        prisma.easterEggScore.findUnique({
          where: { userId: session.user.id },
          select: { score: true },
        }),
      { operationName: "find existing easter egg score" }
    )

    if (existing && existing.score >= score) {
      return NextResponse.json({ score: existing.score, isNewBest: false })
    }

    await withRetry(
      () =>
        prisma.easterEggScore.upsert({
          where: { userId: session.user.id },
          create: { userId: session.user.id, score },
          update: { score },
        }),
      { operationName: "upsert easter egg score" }
    )

    return NextResponse.json({ score, isNewBest: true })
  } catch (error) {
    console.error("Error submitting easter egg score:", error)

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: error.issues[0].message },
        { status: 400 }
      )
    }

    return NextResponse.json(
      { error: "Failed to submit score" },
      { status: 500 }
    )
  }
}
