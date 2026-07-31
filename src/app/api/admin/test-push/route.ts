import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { isAdminFeaturesEnabled } from "@/lib/env"
import { prisma } from "@/lib/prisma"
import { withRetry } from "@/lib/db-retry"
import { sendPushNotification } from "@/lib/push"

export async function POST() {
  try {
    const session = await auth()
    if (
      !session?.user?.id ||
      !session.user.isAdmin ||
      !isAdminFeaturesEnabled()
    ) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const subscriptions = await withRetry(
      () =>
        prisma.pushSubscription.findMany({
          where: { userId: session.user.id },
        }),
      { operationName: "find push subscriptions for test push" }
    )

    if (subscriptions.length === 0) {
      return NextResponse.json(
        { error: "No push subscriptions found — enable notifications first" },
        { status: 400 }
      )
    }

    console.log(`[Admin] Test push triggered by ${session.user.id}`)

    let sent = 0
    let failed = 0

    for (const subscription of subscriptions) {
      const result = await sendPushNotification(subscription, {
        title: "Test notification",
        body: "If you can see this, push is working.",
        url: "/",
      })

      if (result.success) {
        sent++
      } else {
        failed++
        if (result.expired) {
          await withRetry(
            () =>
              prisma.pushSubscription.delete({
                where: { id: subscription.id },
              }),
            { operationName: "delete expired push subscription" }
          )
        }
      }
    }

    return NextResponse.json({ success: true, sent, failed })
  } catch (error) {
    console.error("[Admin] Test push error:", error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Test push failed" },
      { status: 500 }
    )
  }
}
