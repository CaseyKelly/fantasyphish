import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { withRetry } from "@/lib/db-retry"
import { Prisma } from "@prisma/client"
import { z } from "zod"
import { updateUsernameSchema } from "./schema"

export async function PATCH(request: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const body = await request.json()
    const { username } = updateUsernameSchema.parse(body)

    const existingUsername = await withRetry(
      () =>
        prisma.user.findFirst({
          where: {
            username: { equals: username, mode: "insensitive" },
            NOT: { id: session.user.id },
          },
          select: { id: true },
        }),
      { operationName: "check username uniqueness" }
    )

    if (existingUsername) {
      return NextResponse.json(
        { error: "This username is already taken" },
        { status: 400 }
      )
    }

    const updatedUser = await withRetry(
      () =>
        prisma.user.update({
          where: { id: session.user.id },
          data: { username },
        }),
      { operationName: "update username" }
    )

    return NextResponse.json({
      success: true,
      username: updatedUser.username,
    })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: error.issues[0].message },
        { status: 400 }
      )
    }

    // Guards against a race where two requests pass the uniqueness check
    // before either has committed its update.
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      return NextResponse.json(
        { error: "This username is already taken" },
        { status: 400 }
      )
    }

    console.error("Error updating username:", error)
    return NextResponse.json(
      { error: "Failed to update username" },
      { status: 500 }
    )
  }
}
