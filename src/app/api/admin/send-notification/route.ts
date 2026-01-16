import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { isAdminFeaturesEnabled } from "@/lib/env"
import { sendBatchNotifications } from "@/lib/firebase-admin"
import { z } from "zod"

const sendNotificationSchema = z.object({
  userIds: z.array(z.string()).optional(),
  showId: z.string().optional(),
  title: z.string().min(1),
  body: z.string().min(1),
  testMode: z.boolean().optional(),
})

export async function POST(request: NextRequest) {
  try {
    // Only admins can send notifications
    const session = await auth()
    if (!session?.user?.isAdmin || !isAdminFeaturesEnabled()) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const body = await request.json()
    const {
      userIds,
      showId,
      title,
      body: messageBody,
      testMode,
    } = sendNotificationSchema.parse(body)

    // Determine target users
    let targetUserIds: string[] = []

    if (testMode) {
      // Test mode: only send to admins
      const admins = await prisma.user.findMany({
        where: { isAdmin: true },
        select: { id: true },
      })
      targetUserIds = admins.map((u) => u.id)
    } else if (userIds && userIds.length > 0) {
      // Specific users
      targetUserIds = userIds
    } else if (showId) {
      // Users who haven't submitted picks for this show
      const show = await prisma.show.findUnique({
        where: { id: showId },
        include: {
          submissions: {
            select: { userId: true },
          },
        },
      })

      if (!show) {
        return NextResponse.json({ error: "Show not found" }, { status: 404 })
      }

      // Get all users with active tokens and notifications enabled
      const allUsersWithPrefs = await prisma.user.findMany({
        where: {
          notificationPreferences: {
            pickRemindersEnabled: true,
          },
          pushTokens: {
            some: {
              isActive: true,
            },
          },
        },
        select: { id: true },
      })

      // Exclude users who already submitted
      const submittedUserIds = new Set(show.submissions.map((s) => s.userId))
      targetUserIds = allUsersWithPrefs
        .filter((u) => !submittedUserIds.has(u.id))
        .map((u) => u.id)
    } else {
      // All users with notifications enabled
      const allUsers = await prisma.user.findMany({
        where: {
          notificationPreferences: {
            pickRemindersEnabled: true,
          },
          pushTokens: {
            some: {
              isActive: true,
            },
          },
        },
        select: { id: true },
      })
      targetUserIds = allUsers.map((u) => u.id)
    }

    if (targetUserIds.length === 0) {
      return NextResponse.json({
        success: true,
        message: "No users to notify",
        sentCount: 0,
        failedCount: 0,
      })
    }

    // Get all active push tokens for target users
    const pushTokens = await prisma.pushToken.findMany({
      where: {
        userId: { in: targetUserIds },
        isActive: true,
      },
      include: {
        user: {
          select: { id: true, username: true },
        },
      },
    })

    if (pushTokens.length === 0) {
      return NextResponse.json({
        success: true,
        message: "No active push tokens found",
        sentCount: 0,
        failedCount: 0,
      })
    }

    // Send batch notifications
    const tokens = pushTokens.map((t) => t.token)
    const result = await sendBatchNotifications({
      tokens,
      title,
      body: messageBody,
      data: showId ? { showId } : undefined,
    })

    // Mark invalid tokens as inactive
    if (result.invalidTokens.length > 0) {
      await prisma.pushToken.updateMany({
        where: {
          token: { in: result.invalidTokens },
        },
        data: {
          isActive: false,
        },
      })
    }

    // Log notifications
    const notificationLogs = pushTokens.map((pt) => ({
      userId: pt.userId,
      showId: showId || null,
      type: testMode ? "manual_test" : "manual_admin",
      title,
      body: messageBody,
      success: !result.invalidTokens.includes(pt.token),
      error: result.invalidTokens.includes(pt.token)
        ? "Invalid or expired token"
        : null,
    }))

    await prisma.notificationLog.createMany({
      data: notificationLogs,
    })

    return NextResponse.json({
      success: true,
      message: `Sent ${result.successCount} notifications, ${result.failureCount} failed`,
      sentCount: result.successCount,
      failedCount: result.failureCount,
      targetUsers: targetUserIds.length,
      invalidTokensRemoved: result.invalidTokens.length,
    })
  } catch (error) {
    console.error("Error sending notification:", error)

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: error.issues[0].message },
        { status: 400 }
      )
    }

    return NextResponse.json(
      { error: "Failed to send notification" },
      { status: 500 }
    )
  }
}
