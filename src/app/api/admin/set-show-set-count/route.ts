import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { withRetry } from "@/lib/db-retry"
import { isAdminFeaturesEnabled } from "@/lib/env"
import { MAX_SET_COUNT, MIN_SET_COUNT } from "@/lib/pick-rules"
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

    // Existing submissions were built for the current number of opener
    // slots, so the set count is frozen once anyone has picked. The
    // no-submissions condition lives in the update itself so a submission
    // landing between a separate check and this write can't slip through.
    const { count } = await withRetry(
      () =>
        prisma.show.updateMany({
          where: { id: showId, isComplete: false, submissions: { none: {} } },
          data: { setCount },
        }),
      { operationName: "set show set count" }
    )
    if (count === 0) {
      return NextResponse.json(
        {
          error:
            "Picks have already been submitted for this show, so its set count can't change",
        },
        { status: 409 }
      )
    }

    return NextResponse.json({ success: true, show: { id: showId, setCount } })
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
