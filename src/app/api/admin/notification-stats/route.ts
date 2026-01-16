import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { isAdminFeaturesEnabled } from "@/lib/env"
import { getNotificationStats } from "@/lib/notifications"

export async function GET(request: NextRequest) {
  const session = await auth()

  if (!session?.user?.isAdmin || !isAdminFeaturesEnabled()) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 })
  }

  try {
    const stats = await getNotificationStats()
    return NextResponse.json(stats)
  } catch (error) {
    console.error("Failed to get notification stats:", error)
    return NextResponse.json(
      { error: "Failed to get notification stats" },
      { status: 500 }
    )
  }
}
