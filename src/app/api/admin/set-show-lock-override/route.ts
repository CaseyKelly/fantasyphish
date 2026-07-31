import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { withRetry } from "@/lib/db-retry"
import { isAdminFeaturesEnabled } from "@/lib/env"
import { getShowLockTime, getTimezoneForLocation } from "@/lib/timezone"
import { z } from "zod"

const setLockOverrideSchema = z.object({
  showId: z.string().min(1),
  lockTime: z.string().datetime().nullable(),
})

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

    const body = await request.json()
    const { showId, lockTime } = setLockOverrideSchema.parse(body)

    const show = await prisma.show.findUnique({ where: { id: showId } })
    if (!show) {
      return NextResponse.json({ error: "Show not found" }, { status: 404 })
    }
    if (show.isComplete) {
      return NextResponse.json(
        { error: "Cannot change lock time for a completed show" },
        { status: 400 }
      )
    }

    if (lockTime) {
      const overrideTime = new Date(lockTime)
      const updated = await withRetry(
        () =>
          prisma.show.update({
            where: { id: showId },
            data: {
              lockTime: overrideTime,
              lockTimeOverride: overrideTime,
            },
          }),
        { operationName: "set show lock time override" }
      )
      return NextResponse.json({ success: true, show: updated })
    }

    // Clear override: revert to the standard computed lock time
    const timezone = show.timezone || getTimezoneForLocation(show.state)
    const computedLockTime = getShowLockTime(show.showDate, timezone)
    const updated = await withRetry(
      () =>
        prisma.show.update({
          where: { id: showId },
          data: {
            lockTime: computedLockTime,
            lockTimeOverride: null,
          },
        }),
      { operationName: "clear show lock time override" }
    )
    return NextResponse.json({ success: true, show: updated })
  } catch (error) {
    console.error("[Admin] Set show lock override error:", error)

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: error.issues[0].message },
        { status: 400 }
      )
    }

    return NextResponse.json(
      { error: "Failed to update show lock time" },
      { status: 500 }
    )
  }
}
