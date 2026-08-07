import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { withRetry } from "@/lib/db-retry"
import { awardSongPickAchievement } from "@/lib/achievement-awards"
import { z } from "zod"
import { updatePreferencesSchema } from "./schema"

export async function GET() {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const user = await withRetry(
      () =>
        prisma.user.findUnique({
          where: { id: session.user.id },
          select: {
            emailPickReminders: true,
            _count: { select: { pushSubscriptions: true } },
          },
        }),
      { operationName: "fetch user preferences" }
    )

    return NextResponse.json({
      emailPickReminders: !!user?.emailPickReminders,
      hasPushSubscription: !!user && user._count.pushSubscriptions > 0,
    })
  } catch (error) {
    console.error("Error fetching user preferences:", error)
    return NextResponse.json(
      { error: "Failed to fetch preferences" },
      { status: 500 }
    )
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const body = await request.json()
    const data = updatePreferencesSchema.parse(body)

    if (data.emailPickReminders) {
      const user = await withRetry(
        () =>
          prisma.user.findUnique({
            where: { id: session.user.id },
            select: { emailVerified: true },
          }),
        { operationName: "check email verification for preferences update" }
      )

      if (!user?.emailVerified) {
        return NextResponse.json(
          { error: "Verify your email before enabling email reminders" },
          { status: 400 }
        )
      }
    }

    await withRetry(
      () =>
        prisma.user.update({
          where: { id: session.user.id },
          data,
        }),
      { operationName: "update user preferences" }
    )

    if (data.emailPickReminders) {
      await awardSongPickAchievement(session.user.id, "NOTIFICATIONS_ENABLED")
    }

    return NextResponse.json({ success: true, ...data })
  } catch (error) {
    console.error("Error updating user preferences:", error)

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: error.issues[0].message },
        { status: 400 }
      )
    }

    return NextResponse.json(
      { error: "Failed to update preferences" },
      { status: 500 }
    )
  }
}
