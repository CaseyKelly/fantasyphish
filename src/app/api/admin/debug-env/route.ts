import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"

export async function GET() {
  try {
    // Check admin auth
    const session = await auth()
    if (!session?.user?.id || !session.user.isAdmin) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // Check if PHISHNET_API_KEY is loaded
    const hasApiKey = !!process.env.PHISHNET_API_KEY
    const keyLength = process.env.PHISHNET_API_KEY?.length || 0

    return NextResponse.json({
      hasApiKey,
      keyLength,
      // Don't expose the actual key, just debug info
      keyStart: process.env.PHISHNET_API_KEY?.substring(0, 4) || "none",
    })
  } catch {
    return NextResponse.json({ error: "Debug check failed" }, { status: 500 })
  }
}
