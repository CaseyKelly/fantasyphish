import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { getSetlist, parseSetlist } from "@/lib/phishnet"
import { withRetry } from "@/lib/db-retry"
import { shouldRunCronJobs } from "@/lib/cron-helpers"
import { scoreShow } from "@/lib/show-scoring"

// Force dynamic rendering and disable caching
export const dynamic = "force-dynamic"
export const runtime = "nodejs"

// This endpoint is called by the cron job to score shows progressively
export async function POST(request: Request) {
  const startTime = Date.now()
  console.log(`[Score:POST] ========================================`)
  console.log(`[Score:POST] Cron job started at ${new Date().toISOString()}`)
  console.log(
    `[Score:POST] Request headers: ${JSON.stringify(Object.fromEntries(request.headers.entries()))}`
  )

  try {
    // Verify cron secret (optional to configure, but enforced when CRON_SECRET is set)
    // Vercel cron jobs send "Vercel-Cron" as user-agent and are allowed without CRON_SECRET
    // Manual triggers require the correct CRON_SECRET when it is configured
    const authHeader = request.headers.get("authorization")
    const userAgent = request.headers.get("user-agent")
    const token = authHeader?.replace("Bearer ", "")
    const cronSecret = process.env.CRON_SECRET
    const isVercelCron = userAgent === "Vercel-Cron"

    console.log(
      `[Score:POST] Auth check: cronSecret=${cronSecret ? "SET" : "NOT_SET"}, authHeader=${authHeader ? "PROVIDED" : "MISSING"}, isVercelCron=${isVercelCron}`
    )

    // Allow requests from:
    // 1. Vercel cron (user-agent: "Vercel-Cron")
    // 2. Manual triggers with correct CRON_SECRET
    if (!isVercelCron && cronSecret && token !== cronSecret) {
      console.error(
        "[Score:POST] Unauthorized: not Vercel cron and invalid/missing CRON_SECRET"
      )
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    console.log("[Score:POST] Authorization successful")

    // Check if cron jobs should run (only when tours are active)
    let shouldRunResult: { shouldRun: boolean; reason?: string }
    try {
      shouldRunResult = await shouldRunCronJobs()
    } catch (dbError) {
      const msg = dbError instanceof Error ? dbError.message : String(dbError)
      const isConnectionError =
        msg.includes("Can't reach database server") ||
        msg.includes("Connection") ||
        msg.includes("P1001") ||
        msg.includes("ECONNREFUSED") ||
        msg.includes("ETIMEDOUT") ||
        msg.includes("Error in PostgreSQL connection")
      if (!isConnectionError) throw dbError
      console.error(
        `[Score:POST] Database unreachable during shouldRunCronJobs check: ${msg}`
      )
      return NextResponse.json(
        { skipped: true, reason: "database_unavailable" },
        { status: 200 }
      )
    }
    const { shouldRun, reason } = shouldRunResult
    if (!shouldRun) {
      console.log(`[Score:POST] Skipping: ${reason}`)
      return NextResponse.json({ skipped: true, reason }, { status: 200 })
    }

    console.log("[Score:POST] Active tours found, proceeding with scoring")

    // Find shows that need scoring:
    // 1. Shows with locked picks (lockTime has passed)
    // 2. Shows that aren't complete yet (isComplete is only set after grace period)
    const showsToScore = await withRetry(
      async () =>
        prisma.show.findMany({
          where: {
            lockTime: { lte: new Date() }, // Only score shows that are locked
            isComplete: false, // Only check incomplete shows (includes grace period)
          },
          include: {
            submissions: {
              include: {
                picks: {
                  include: { song: true },
                },
              },
            },
          },
        }),
      { operationName: "find shows to score" }
    )

    console.log(`[Score:POST] Found ${showsToScore.length} show(s) to check`)

    const results = []

    for (const show of showsToScore) {
      // Extract the date in UTC to avoid timezone conversion
      const showDateStr = show.showDate.toISOString().split("T")[0]
      console.log(
        `[Score:POST] Processing show ${showDateStr} (${show.venue}, ${show.city})`
      )

      // Use noCache to bypass Next.js cache and get fresh setlist data during shows
      const setlist = await getSetlist(showDateStr, { noCache: true })

      // Log the API response
      if (!setlist) {
        console.log(`[Score:POST]   No setlist data returned from API`)
        results.push({
          showId: show.id,
          showDate: showDateStr,
          status: "no_setlist",
          message: "No setlist data available yet",
        })
        continue
      }

      // Log the raw API response for debugging
      console.log(
        `[Score:POST]   API Response: ${JSON.stringify(setlist, null, 2)}`
      )

      // Log parsed songs from setlist
      const parsedSetlist = parseSetlist(setlist)
      console.log(
        `[Score:POST]   ✓ Fetched setlist with ${parsedSetlist.allSongs.length} song(s)`
      )
      console.log(`[Score:POST]   Songs: ${parsedSetlist.allSongs.join(", ")}`)
      console.log(`[Score:POST]   Opener: ${parsedSetlist.opener || "N/A"}`)
      console.log(
        `[Score:POST]   Encore: ${parsedSetlist.encoreSongs.length > 0 ? parsedSetlist.encoreSongs.join(", ") : "N/A"}`
      )

      const result = await scoreShow(show, setlist, {
        logPrefix: "[Score:POST]",
      })

      results.push({
        showId: show.id,
        showDate: showDateStr,
        ...result,
      })
    }

    const duration = Date.now() - startTime
    console.log(`[Score:POST] ✓ Complete in ${duration}ms`)
    console.log(
      `[Score:POST] Summary: ${results.filter((r) => r.status === "in_progress").length} in progress, ${results.filter((r) => r.status === "completed").length} completed`
    )
    console.log(`[Score:POST] ========================================`)

    return NextResponse.json({
      success: true,
      duration: `${duration}ms`,
      showsProcessed: showsToScore.length,
      results,
    })
  } catch (error) {
    const duration = Date.now() - startTime
    console.error("[Score:POST] ✗ Error scoring shows:", error)
    console.error("[Score:POST] ✗ Error details:", {
      message: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    })
    console.log(`[Score:POST] ========================================`)
    return NextResponse.json(
      {
        error: "Failed to score shows",
        details: error instanceof Error ? error.message : String(error),
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
  // Vercel cron makes GET requests, so we handle scoring here
  // Just delegate to POST handler
  return POST(request)
}
