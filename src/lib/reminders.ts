import { prisma } from "@/lib/prisma"
import { withRetry } from "@/lib/db-retry"
import { sendShowReminderEmail } from "@/lib/email"

export interface ReminderRunResult {
  showsChecked: number
  eligibleUsers: number
  sent: number
  failed: number
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
          select: { id: true, email: true },
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
    }
  }

  return result
}
