import { NextRequest, NextResponse } from "next/server"
import { sendPickReminders } from "@/lib/notifications"

// This endpoint is called by Vercel Cron every hour
export async function GET(request: NextRequest) {
  try {
    // Verify the request is from Vercel Cron
    const authHeader = request.headers.get("authorization")
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    console.log("⏰ Running pick reminders cron job...")

    const result = await sendPickReminders()

    console.log(
      `✅ Pick reminders cron completed: ${result.showsProcessed} shows, ${result.sentCount} sent, ${result.failedCount} failed`
    )

    return NextResponse.json(result)
  } catch (error) {
    console.error("❌ Pick reminders cron failed:", error)
    return NextResponse.json(
      { error: "Failed to send pick reminders" },
      { status: 500 }
    )
  }
}
