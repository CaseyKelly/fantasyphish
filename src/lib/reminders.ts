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
  const todayStr = new Date().toISOString().split("T")[0]

  const shows = await withRetry(
    () =>
      prisma.show.findMany({
        where: { isComplete: false },
      }),
    { operationName: "find shows for reminders" }
  )

  const todaysShows = shows.filter(
    (show) => show.showDate.toISOString().split("T")[0] === todayStr
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
