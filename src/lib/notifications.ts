import { prisma } from "@/lib/prisma"
import { sendBatchNotifications } from "@/lib/firebase-admin"

/**
 * Send pick reminder notifications for upcoming shows
 * Called by cron job every hour
 */
export async function sendPickReminders() {
  try {
    const now = new Date()
    const oneHourLater = new Date(now.getTime() + 60 * 60 * 1000)
    const ninetyMinutesLater = new Date(now.getTime() + 90 * 60 * 1000)

    // Find shows with lockTime between 60-90 minutes from now
    const upcomingShows = await prisma.show.findMany({
      where: {
        lockTime: {
          gte: oneHourLater,
          lte: ninetyMinutesLater,
        },
        isComplete: false,
      },
      include: {
        tour: true,
        submissions: {
          select: { userId: true },
        },
      },
    })

    console.log(
      `Found ${upcomingShows.length} shows with lockTime in next 60-90 minutes`
    )

    let totalSent = 0
    let totalFailed = 0

    for (const show of upcomingShows) {
      // Get users who haven't submitted picks and have notifications enabled
      const submittedUserIds = new Set(show.submissions.map((s) => s.userId))

      const usersToNotify = await prisma.user.findMany({
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
        include: {
          pushTokens: {
            where: {
              isActive: true,
            },
          },
        },
      })

      // Filter out users who already submitted
      const usersWithoutPicks = usersToNotify.filter(
        (u) => !submittedUserIds.has(u.id)
      )

      if (usersWithoutPicks.length === 0) {
        console.log(`No users to notify for show ${show.venue}`)
        continue
      }

      // Collect all push tokens
      const tokens: string[] = []
      const tokenToUser = new Map<string, string>()

      for (const user of usersWithoutPicks) {
        for (const token of user.pushTokens) {
          tokens.push(token.token)
          tokenToUser.set(token.token, user.id)
        }
      }

      // Send notifications
      const title = "Don't Forget Your Picks! 🎸"
      const body = `Make your picks for ${show.venue} before ${show.lockTime ? new Date(show.lockTime).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", timeZone: show.timezone || "America/New_York" }) : "7 PM"}!`

      const result = await sendBatchNotifications({
        tokens,
        title,
        body,
        data: {
          showId: show.id,
          type: "pick_reminder",
        },
      })

      totalSent += result.successCount
      totalFailed += result.failureCount

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
      const notificationLogs = tokens.map((token) => ({
        userId: tokenToUser.get(token)!,
        showId: show.id,
        type: "pick_reminder",
        title,
        body,
        success: !result.invalidTokens.includes(token),
        error: result.invalidTokens.includes(token)
          ? "Invalid or expired token"
          : null,
      }))

      await prisma.notificationLog.createMany({
        data: notificationLogs,
      })

      console.log(
        `Sent ${result.successCount} notifications for ${show.venue}, ${result.failureCount} failed`
      )
    }

    return {
      success: true,
      showsProcessed: upcomingShows.length,
      sentCount: totalSent,
      failedCount: totalFailed,
    }
  } catch (error) {
    console.error("Error sending pick reminders:", error)
    throw error
  }
}

/**
 * Get notification statistics for admin panel
 */
export async function getNotificationStats() {
  try {
    const [
      totalActiveTokens,
      usersWithNotificationsEnabled,
      todayNotifications,
    ] = await Promise.all([
      prisma.pushToken.count({
        where: { isActive: true },
      }),
      prisma.notificationPreferences.count({
        where: { pickRemindersEnabled: true },
      }),
      prisma.notificationLog.count({
        where: {
          sentAt: {
            gte: new Date(new Date().setHours(0, 0, 0, 0)),
          },
        },
      }),
    ])

    return {
      totalActiveTokens,
      usersWithNotificationsEnabled,
      todayNotifications,
    }
  } catch (error) {
    console.error("Error getting notification stats:", error)
    throw error
  }
}

/**
 * Get recent notification logs for admin panel
 */
export async function getRecentNotificationLogs(limit = 50) {
  try {
    const logs = await prisma.notificationLog.findMany({
      take: limit,
      orderBy: { sentAt: "desc" },
      include: {
        user: {
          select: {
            username: true,
            email: true,
          },
        },
        show: {
          select: {
            venue: true,
            showDate: true,
          },
        },
      },
    })

    return logs
  } catch (error) {
    console.error("Error getting notification logs:", error)
    throw error
  }
}
