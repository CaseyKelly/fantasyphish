import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { isAdminFeaturesEnabled } from "@/lib/env"

export async function POST() {
  // Only allow in non-production environments
  if (!isAdminFeaturesEnabled()) {
    return NextResponse.json(
      {
        error: "Impersonation is only available in non-production environments",
      },
      { status: 403 }
    )
  }

  const session = await auth()

  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  // Check if user is impersonating
  if (!session.impersonating) {
    return NextResponse.json(
      { error: "Not currently impersonating" },
      { status: 400 }
    )
  }

  // Return success - the client will update the session
  return NextResponse.json({
    success: true,
    originalUser: {
      id: session.impersonating.originalUserId,
      username: session.impersonating.originalUsername,
      isAdmin: session.impersonating.originalIsAdmin,
    },
  })
}
