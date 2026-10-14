import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { withRetry } from "@/lib/db-retry"
import { isAdminFeaturesEnabled } from "@/lib/env"
import {
  getPickUpdateNeeded,
  MAX_SET_COUNT,
  MIN_SET_COUNT,
} from "@/lib/pick-rules"
import { z } from "zod"

const setSetCountSchema = z.object({
  showId: z.string().min(1),
  setCount: z.number().int().min(MIN_SET_COUNT).max(MAX_SET_COUNT),
})

export async function POST(request: NextRequest) {
  try {
    const session = await auth()
    const isAdmin =
      session?.impersonating?.originalIsAdmin ?? session?.user?.isAdmin
    if (!session?.user?.id || !isAdmin || !isAdminFeaturesEnabled()) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const body = await request.json()
    const { showId, setCount } = setSetCountSchema.parse(body)

    const show = await withRetry(
      () => prisma.show.findUnique({ where: { id: showId } }),
      { operationName: "find show for set count" }
    )
    if (!show) {
      return NextResponse.json({ error: "Show not found" }, { status: 404 })
    }
    if (show.isComplete) {
      return NextResponse.json(
        { error: "Cannot change the set count for a completed show" },
        { status: 400 }
      )
    }

    if (show.lockTime && show.lockTime <= new Date()) {
      return NextResponse.json(
        { error: "Picks have already locked for this show" },
        { status: 400 }
      )
    }

    if (setCount < show.setCount) {
      // Lowering would leave existing opener picks pointing at a set the
      // show no longer has, so it's only allowed before anyone has picked.
      // The no-submissions condition lives in the update itself so a
      // submission landing between a separate check and this write can't
      // slip through.
      const { count } = await withRetry(
        () =>
          prisma.show.updateMany({
            where: { id: showId, isComplete: false, submissions: { none: {} } },
            data: { setCount },
          }),
        { operationName: "lower show set count" }
      )
      if (count === 0) {
        return NextResponse.json(
          {
            error:
              "Picks have already been submitted for this show, so its set count can only go up",
          },
          { status: 409 }
        )
      }
    } else if (setCount > show.setCount) {
      // Raising is safe with picks in: saved submissions keep scoring as
      // they are, and the picker prompts their owners to add the new set
      // openers (see getPickUpdateNeeded).
      await withRetry(
        () =>
          prisma.show.update({
            where: { id: showId },
            data: { setCount },
          }),
        { operationName: "raise show set count" }
      )
    }

    const submissions = await withRetry(
      () =>
        prisma.submission.findMany({
          where: { showId },
          select: { picks: { select: { pickType: true, openerSet: true } } },
        }),
      { operationName: "find submissions for set count" }
    )
    const submissionsNeedingUpdate = submissions.filter(
      (submission) => getPickUpdateNeeded(submission.picks, setCount) !== null
    ).length

    return NextResponse.json({
      success: true,
      show: { id: showId, setCount },
      submissionsNeedingUpdate,
    })
  } catch (error) {
    console.error("[Admin] Set show set count error:", error)

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: error.issues[0].message },
        { status: 400 }
      )
    }

    return NextResponse.json(
      { error: "Failed to update show set count" },
      { status: 500 }
    )
  }
}
