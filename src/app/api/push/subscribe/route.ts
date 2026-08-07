import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { withRetry } from "@/lib/db-retry"
import { awardSongPickAchievement } from "@/lib/achievement-awards"
import { z } from "zod"

const subscribeSchema = z.object({
  endpoint: z.string().url(),
  keys: z.object({
    p256dh: z.string(),
    auth: z.string(),
  }),
})

const unsubscribeSchema = z.object({
  endpoint: z.string().url(),
})

export async function POST(request: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const body = await request.json()
    const data = subscribeSchema.parse(body)

    await withRetry(
      () =>
        prisma.pushSubscription.upsert({
          where: { endpoint: data.endpoint },
          create: {
            userId: session.user.id,
            endpoint: data.endpoint,
            p256dh: data.keys.p256dh,
            auth: data.keys.auth,
          },
          update: {
            userId: session.user.id,
            p256dh: data.keys.p256dh,
            auth: data.keys.auth,
          },
        }),
      { operationName: "save push subscription" }
    )

    await awardSongPickAchievement(session.user.id, "NOTIFICATIONS_ENABLED")

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Error saving push subscription:", error)

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: error.issues[0].message },
        { status: 400 }
      )
    }

    return NextResponse.json(
      { error: "Failed to save push subscription" },
      { status: 500 }
    )
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const body = await request.json()
    const data = unsubscribeSchema.parse(body)

    await withRetry(
      () =>
        prisma.pushSubscription.deleteMany({
          where: { endpoint: data.endpoint, userId: session.user.id },
        }),
      { operationName: "delete push subscription" }
    )

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Error deleting push subscription:", error)

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: error.issues[0].message },
        { status: 400 }
      )
    }

    return NextResponse.json(
      { error: "Failed to delete push subscription" },
      { status: 500 }
    )
  }
}
