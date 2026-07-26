import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { shouldRunCronJobs } from "@/lib/cron-helpers"
import { sendPickReminders } from "@/lib/reminders"

// Force dynamic rendering and disable caching
export const dynamic = "force-dynamic"
export const runtime = "nodejs"

export async function POST(request: Request) {
  const startTime = Date.now()

  try {
    console.log(
      `[Send Reminders] Cron job started at ${new Date().toISOString()}`
    )

    // Verify authorization
    // Vercel cron jobs send "Vercel-Cron" as user-agent and are allowed without CRON_SECRET
    const authHeader = request.headers.get("authorization")
    const userAgent = request.headers.get("user-agent")
    const token = authHeader?.replace("Bearer ", "")
    const cronSecret = process.env.CRON_SECRET
    const isVercelCron = userAgent === "Vercel-Cron"

    console.log(
      `[Send Reminders] Auth check: cronSecret=${cronSecret ? "SET" : "NOT_SET"}, authHeader=${authHeader ? "PROVIDED" : "MISSING"}, isVercelCron=${isVercelCron}`
    )

    // Allow requests from:
    // 1. Vercel cron (user-agent: "Vercel-Cron")
    // 2. Manual triggers with correct CRON_SECRET
    if (!isVercelCron && cronSecret && token !== cronSecret) {
      console.error("[Send Reminders] ✗ Unauthorized request")
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    console.log("[Send Reminders] Authorization successful")

    // Check if cron jobs should run (only when tours are active)
    const { shouldRun, reason } = await shouldRunCronJobs()
    if (!shouldRun) {
      console.log(`[Send Reminders] Skipping: ${reason}`)
      return NextResponse.json({ skipped: true, reason }, { status: 200 })
    }

    const result = await sendPickReminders()

    const duration = Date.now() - startTime
    console.log(
      `[Send Reminders] ✓ Sent ${result.sent}/${result.eligibleUsers} reminders in ${duration}ms (${result.failed} failed)`
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
