import * as Sentry from "@sentry/nextjs"
import type { NextResponse } from "next/server"
import { verifyCronRequest } from "@/lib/cron-auth"
import { isProduction } from "@/lib/env"

type MonitorConfig = NonNullable<Parameters<typeof Sentry.withMonitor>[2]>

export interface CronMonitor {
  slug: string
  config: MonitorConfig
}

// Vercel's default function timeout is 300s, so a run still in progress
// after a few minutes was killed without sending its closing check-in.
function dailyAt(schedule: string): MonitorConfig {
  return {
    schedule: { type: "crontab", value: schedule },
    checkinMargin: 30,
    maxRuntime: 10,
    timezone: "UTC",
  }
}

/**
 * Sentry cron monitors, upserted from code on each check-in. Every schedule
 * must match the cron's entry in vercel.json (fixed UTC).
 */
export const CRON_MONITORS = {
  score: {
    slug: "fantasyphish-score",
    config: {
      schedule: { type: "crontab", value: "*/10 * * * *" },
      // Must stay under the 10 minute interval, or a missed run would
      // overlap the next one
      checkinMargin: 5,
      maxRuntime: 6,
      timezone: "UTC",
      // One flaky phish.net fetch shouldn't page; two in a row (20 minutes
      // of stale scores mid-show) should
      failureIssueThreshold: 2,
    },
  },
  syncTours: { slug: "fantasyphish-sync-tours", config: dailyAt("0 6 * * *") },
  syncSongStats: {
    slug: "fantasyphish-sync-song-stats",
    config: dailyAt("0 7 * * *"),
  },
  awardAchievements: {
    slug: "fantasyphish-award-achievements",
    config: dailyAt("0 8 * * *"),
  },
  // Scheduled at both 18:00 and 19:00 UTC to cover MDT and MST; the
  // off-hour run is a healthy no-op check-in
  sendReminders: {
    slug: "fantasyphish-send-reminders",
    config: dailyAt("0 18,19 * * *"),
  },
} satisfies Record<string, CronMonitor>

class CronJobFailed extends Error {
  constructor(readonly response: NextResponse) {
    super(`Cron job responded with ${response.status}`)
  }
}

/**
 * Authorize a cron request, then run `job` inside a Sentry cron monitor.
 *
 * Auth happens first, outside the monitor, so unauthorized requests never
 * create a check-in. Any non-2xx response from `job` (the cron routes catch
 * their own errors and return a 500) marks the check-in as failed; early
 * returns like "no active tours" are 200s and count as healthy runs.
 *
 * Vercel only schedules crons in production, so manual runs on previews or
 * locally skip the monitor; otherwise Sentry would expect them on schedule
 * and alert on missed runs in those environments.
 */
export async function runMonitoredCron(
  request: Request,
  logPrefix: string,
  monitor: CronMonitor,
  job: () => Promise<NextResponse>
): Promise<NextResponse> {
  const authError = verifyCronRequest(request, logPrefix)
  if (authError) return authError

  if (!isProduction()) return job()

  try {
    return await Sentry.withMonitor(
      monitor.slug,
      async () => {
        const response = await job()
        // withMonitor only reports "error" when the callback throws
        if (!response.ok) throw new CronJobFailed(response)
        return response
      },
      monitor.config
    )
  } catch (error) {
    if (error instanceof CronJobFailed) return error.response
    throw error
  } finally {
    // Serverless functions can freeze once the response is sent, so send
    // the check-ins before returning
    await Sentry.flush(2000)
  }
}
