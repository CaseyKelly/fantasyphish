import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { isAdminFeaturesEnabled } from "@/lib/env"
import { getRecentNotificationLogs } from "@/lib/notifications"

export async function GET(request: NextRequest) {
  const session = await auth()

  if (!session?.user?.isAdmin || !isAdminFeaturesEnabled()) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 })
  }

  try {
    const { searchParams } = new URL(request.url)
    const limit = parseInt(searchParams.get("limit") || "20")

    const logs = await getRecentNotificationLogs(limit)
    return NextResponse.json({ logs })
  } catch (error) {
    console.error("Failed to get notification logs:", error)
    return NextResponse.json(
      { error: "Failed to get notification logs" },
      { status: 500 }
    )
  }
}
