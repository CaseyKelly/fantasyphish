import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { isAdminFeaturesEnabled } from "@/lib/env"
import { sendPickReminders } from "@/lib/reminders"

export async function POST(request: NextRequest) {
  try {
    const session = await auth()
    if (
      !session?.user?.id ||
      !session.user.isAdmin ||
      !isAdminFeaturesEnabled()
    ) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const body = await request.json().catch(() => ({}))

    console.log(
      `[Admin] Test reminders triggered by ${session.user.id}${
        body.dryRunSelf ? " (self only)" : ""
      }`
    )

    const result = await sendPickReminders(
      body.dryRunSelf ? { dryRunUserId: session.user.id } : undefined
    )

    return NextResponse.json({ success: true, ...result })
  } catch (error) {
    console.error("[Admin] Test reminders error:", error)
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Test reminder send failed",
      },
      { status: 500 }
    )
  }
}
