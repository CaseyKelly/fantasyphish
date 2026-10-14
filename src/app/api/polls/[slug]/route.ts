import { NextRequest, NextResponse } from "next/server"
import { Prisma } from "@prisma/client"
import { z } from "zod"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { withRetry } from "@/lib/db-retry"
import { awardSongPickAchievement } from "@/lib/achievement-awards"
import {
  getPoll,
  isValidPollOption,
  summarizePollVotes,
  type PollDefinition,
  type PollResults,
} from "@/lib/polls"
import { pollVoteSchema } from "./schema"

interface RouteContext {
  params: Promise<{ slug: string }>
}

async function getPollResults(poll: PollDefinition): Promise<PollResults> {
  const grouped = await withRetry(
    () =>
      prisma.pollVote.groupBy({
        by: ["option"],
        where: { pollSlug: poll.slug },
        _count: { _all: true },
      }),
    { operationName: "count poll votes" }
  )

  return summarizePollVotes(
    poll,
    grouped.map((g) => ({ option: g.option, count: g._count._all }))
  )
}

async function getUserVote(
  poll: PollDefinition,
  userId: string
): Promise<string | null> {
  const vote = await withRetry(
    () =>
      prisma.pollVote.findUnique({
        where: { pollSlug_userId: { pollSlug: poll.slug, userId } },
        select: { option: true },
      }),
    { operationName: "find user poll vote" }
  )
  return vote?.option ?? null
}

// Results are only revealed once the user has voted, so the tally can't
// sway anyone's answer.
export async function GET(
  _request: NextRequest,
  { params }: RouteContext
): Promise<NextResponse> {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { slug } = await params
    const poll = getPoll(slug)
    if (!poll) {
      return NextResponse.json({ error: "Poll not found" }, { status: 404 })
    }

    const userVote = await getUserVote(poll, session.user.id)
    if (!userVote) {
      return NextResponse.json({ userVote: null, results: null })
    }

    return NextResponse.json({
      userVote,
      results: await getPollResults(poll),
    })
  } catch (error) {
    console.error("Error fetching poll:", error)
    return NextResponse.json({ error: "Failed to fetch poll" }, { status: 500 })
  }
}

export async function POST(
  request: NextRequest,
  { params }: RouteContext
): Promise<NextResponse> {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { slug } = await params
    const poll = getPoll(slug)
    if (!poll) {
      return NextResponse.json({ error: "Poll not found" }, { status: 404 })
    }

    const body = await request.json()
    const { option } = pollVoteSchema.parse(body)
    if (!isValidPollOption(poll, option)) {
      return NextResponse.json({ error: "Invalid option" }, { status: 400 })
    }

    try {
      await withRetry(
        () =>
          prisma.pollVote.create({
            data: { pollSlug: poll.slug, userId: session.user.id, option },
          }),
        { operationName: "create poll vote" }
      )
    } catch (error) {
      // The (pollSlug, userId) unique constraint is what limits each user to
      // one vote - a second submission (another tab, double click) gets the
      // original vote and current results back instead of changing anything.
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === "P2002"
      ) {
        return NextResponse.json(
          {
            error: "You've already voted in this poll",
            userVote: await getUserVote(poll, session.user.id),
            results: await getPollResults(poll),
          },
          { status: 409 }
        )
      }
      throw error
    }

    // Idempotent and logs its own failures, so a missed award never fails
    // the vote - the daily award-achievements cron backfills it.
    await awardSongPickAchievement(session.user.id, "SAMPLE_IN_A_JAR", {
      pollSlug: poll.slug,
    })

    return NextResponse.json({
      userVote: option,
      results: await getPollResults(poll),
    })
  } catch (error) {
    console.error("Error submitting poll vote:", error)

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: error.issues[0].message },
        { status: 400 }
      )
    }

    return NextResponse.json(
      { error: "Failed to submit vote" },
      { status: 500 }
    )
  }
}
