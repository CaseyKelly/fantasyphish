import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { shouldRunCronJobs } from "@/lib/cron-helpers"
import { sendPickReminders } from "@/lib/reminders"
import { getHourInTimezone } from "@/lib/date-utils"
import { verifyCronRequest } from "@/lib/cron-auth"

// This cron is scheduled twice daily (18:00 and 19:00 UTC) to cover both
// MDT and MST, since Vercel cron schedules are fixed UTC and don't shift
// with daylight saving. Only the invocation that actually lands at noon
// Mountain should send reminders; the other is a no-op.
const TARGET_HOUR_MT = 12

// Force dynamic rendering and disable caching
export const dynamic = "force-dynamic"
export const runtime = "nodejs"

export async function POST(request: Request) {
  const startTime = Date.now()

  try {
    console.log(
      `[Send Reminders] Cron job started at ${new Date().toISOString()}`
    )

    const authError = verifyCronRequest(request, "[Send Reminders]")
    if (authError) return authError

    console.log("[Send Reminders] Authorization successful")

    // Only proceed on the invocation that actually lands at noon Mountain
    // (see TARGET_HOUR_MT comment above)
    const currentHourMT = getHourInTimezone(new Date(), "America/Denver")
    if (currentHourMT !== TARGET_HOUR_MT) {
      console.log(
        `[Send Reminders] Skipping: current MT hour is ${currentHourMT}, not ${TARGET_HOUR_MT}`
      )
      return NextResponse.json(
        { skipped: true, reason: "Not the target Mountain hour" },
        { status: 200 }
      )
    }

    // Check if cron jobs should run (only when tours are active)
    const { shouldRun, reason } = await shouldRunCronJobs()
    if (!shouldRun) {
      console.log(`[Send Reminders] Skipping: ${reason}`)
      return NextResponse.json({ skipped: true, reason }, { status: 200 })
    }

    const result = await sendPickReminders()

    const duration = Date.now() - startTime
    console.log(
      `[Send Reminders] ✓ ${result.eligibleUsers} eligible users in ${duration}ms — email: ${result.sent} sent/${result.failed} failed, push: ${result.pushSent} notifications sent/${result.pushFailed} failed`
    )

    return NextResponse.json({
      success: true,
      ...result,
      duration: `${duration}ms`,
    })
  } catch (error) {
    const duration = Date.now() - startTime
    console.error("[Send Reminders] ✗ Failed:", error)

    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
        duration: `${duration}ms`,
      },
      { status: 500 }
    )
  } finally {
    await prisma.$disconnect()
  }
}

// GET endpoint - Vercel cron jobs use GET requests
// This is the main entry point for the cron job
export async function GET(request: Request) {
  return POST(request)
}
