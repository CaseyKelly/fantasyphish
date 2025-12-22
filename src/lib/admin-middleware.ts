import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { withRateLimit, rateLimits } from "@/lib/rate-limit"

type SessionUser = {
  id: string
  email: string
  username: string
  isAdmin: boolean
}

type Session = {
  user: SessionUser
}

/**
 * Middleware for admin endpoints that:
 * 1. Checks authentication and admin status
 * 2. Applies rate limiting
 * 3. Handles errors consistently
 */
export function withAdminAuth(
  handler: (req: NextRequest, session: Session) => Promise<NextResponse>
) {
  return withRateLimit(async (req: NextRequest) => {
    try {
      // Check authentication
      const session = await auth()

      if (!session?.user?.id) {
        return NextResponse.json(
          { error: "Authentication required" },
          { status: 401 }
        )
      }

      if (!session.user.isAdmin) {
        return NextResponse.json(
          { error: "Admin access required" },
          { status: 403 }
        )
      }

      // Call the actual handler with the session
      return await handler(req, session)
    } catch (error) {
      console.error("Admin endpoint error:", error)

      // In production, don't expose internal errors
      if (process.env.NODE_ENV === "production") {
        return NextResponse.json(
          { error: "An error occurred" },
          { status: 500 }
        )
      }

      // In development, include error details
      return NextResponse.json(
        {
          error: "An error occurred",
          details: error instanceof Error ? error.message : String(error),
        },
        { status: 500 }
      )
    }
  }, rateLimits.admin)
}
