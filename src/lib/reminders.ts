import { prisma } from "@/lib/prisma"
import { withRetry } from "@/lib/db-retry"
import { sendShowReminderEmail } from "@/lib/email"
import { sendPushNotification } from "@/lib/push"

export interface ReminderRunResult {
  showsChecked: number
  eligibleUsers: number
  sent: number
  failed: number
  pushSent: number
  pushFailed: number
  errors: string[]
}

/**
 * Send show-day pick reminder emails to opted-in users who haven't
 * submitted picks yet for today's show(s).
 *
 * Gated to admins only for the initial rollout - remove the `isAdmin: true`
 * clause below to enable for all opted-in users.
 */
export async function sendPickReminders(options?: {
  dryRunUserId?: string
}): Promise<ReminderRunResult> {
  const now = new Date()
  const todayStart = new Date(now)
  todayStart.setUTCHours(0, 0, 0, 0)
  const tomorrowStart = new Date(todayStart)
  tomorrowStart.setUTCDate(tomorrowStart.getUTCDate() + 1)

  const todaysShows = await withRetry(
    () =>
      prisma.show.findMany({
        where: {
          isComplete: false,
          showDate: { gte: todayStart, lt: tomorrowStart },
          OR: [{ lockTime: null }, { lockTime: { gt: now } }],
        },
      }),
    { operationName: "find todays shows for reminders" }
  )

  const result: ReminderRunResult = {
    showsChecked: todaysShows.length,
    eligibleUsers: 0,
    sent: 0,
    failed: 0,
    pushSent: 0,
    pushFailed: 0,
    errors: [],
  }

  for (const show of todaysShows) {
    const eligibleUsers = await withRetry(
      () =>
        prisma.user.findMany({
          where: {
            isAdmin: true, // TODO: remove this line to roll out to all users
            emailPickReminders: true,
            emailVerified: { not: null },
            submissions: { none: { showId: show.id } },
            ...(options?.dryRunUserId ? { id: options.dryRunUserId } : {}),
          },
          select: { id: true, email: true, pushSubscriptions: true },
        }),
      { operationName: `find eligible reminder users for show ${show.id}` }
    )

    result.eligibleUsers += eligibleUsers.length

    for (const user of eligibleUsers) {
      const { success, error } = await sendShowReminderEmail(user.email, {
        venue: show.venue,
        city: show.city,
        state: show.state,
        showDate: show.showDate,
        lockTime: show.lockTime || show.showDate,
        timezone: show.timezone,
      })

      if (success) {
        result.sent++
      } else {
        result.failed++
        result.errors.push(`${user.email}: ${error}`)
      }

      for (const subscription of user.pushSubscriptions) {
        const pushResult = await sendPushNotification(subscription, {
          title: "Show tonight — pick your setlist",
          body: `You haven't submitted picks for ${show.venue} yet.`,
          url: `/pick/${show.id}`,
        })

        if (pushResult.success) {
          result.pushSent++
        } else {
          result.pushFailed++
          result.errors.push(`${user.email} (push): ${pushResult.error}`)
          if (pushResult.expired) {
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
    }
  }

  return result
}
