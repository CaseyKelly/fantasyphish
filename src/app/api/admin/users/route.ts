import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { isAdminFeaturesEnabled } from "@/lib/env"

export async function GET() {
  // Only allow in non-production environments
  if (!isAdminFeaturesEnabled()) {
    return NextResponse.json(
      {
        error: "This endpoint is only available in non-production environments",
      },
      { status: 403 }
    )
  }

  const session = await auth()

  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  // Get the original user if impersonating
  const originalUserId = session.impersonating
    ? session.impersonating.originalUserId
    : session.user.id

  // Check if the original user is an admin
  const originalUser = await prisma.user.findUnique({
    where: { id: originalUserId },
    select: { isAdmin: true },
  })

  if (!originalUser?.isAdmin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  // Get all users except the current admin
  const users = await prisma.user.findMany({
    where: {
      id: { not: originalUserId },
    },
    select: {
      id: true,
      username: true,
      email: true,
      isAdmin: true,
      createdAt: true,
    },
    orderBy: {
      username: "asc",
    },
  })

  return NextResponse.json({ users })
}
