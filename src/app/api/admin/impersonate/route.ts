import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { isAdminFeaturesEnabled } from "@/lib/env"

export async function POST(request: NextRequest) {
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

  // Determine the original admin user
  // If already impersonating, use the stored original user info
  // Otherwise, use the current session user
  const originalUserId = session.impersonating
    ? session.impersonating.originalUserId
    : session.user.id
  const originalUsername = session.impersonating
    ? session.impersonating.originalUsername
    : session.user.username
  const originalIsAdmin = session.impersonating
    ? session.impersonating.originalIsAdmin
    : session.user.isAdmin

  // Only admins can impersonate
  if (!originalIsAdmin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const body = await request.json()
  const { userId } = body

  if (!userId) {
    return NextResponse.json({ error: "userId is required" }, { status: 400 })
  }

  // Don't allow impersonating yourself
  if (userId === originalUserId) {
    return NextResponse.json(
      { error: "Cannot impersonate yourself" },
      { status: 400 }
    )
  }

  // Find the user to impersonate
  const targetUser = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      username: true,
      email: true,
      isAdmin: true,
    },
  })

  if (!targetUser) {
    return NextResponse.json({ error: "User not found" }, { status: 404 })
  }

  // Return the impersonation data for the client to update the session
  return NextResponse.json({
    success: true,
    impersonation: {
      originalUserId,
      originalUsername,
      originalIsAdmin,
      targetUser: {
        id: targetUser.id,
        username: targetUser.username,
        email: targetUser.email,
        isAdmin: targetUser.isAdmin,
      },
    },
  })
}
