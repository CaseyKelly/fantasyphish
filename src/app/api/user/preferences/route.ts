import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { withRetry } from "@/lib/db-retry"
import { z } from "zod"

const updatePreferencesSchema = z
  .object({
    emailPickReminders: z.boolean().optional(),
  })
  .refine((data) => Object.keys(data).length > 0, {
    message: "At least one preference is required",
  })

export async function PATCH(request: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const body = await request.json()
    const data = updatePreferencesSchema.parse(body)

    await withRetry(
      () =>
        prisma.user.update({
          where: { id: session.user.id },
          data,
        }),
      { operationName: "update user preferences" }
    )

    return NextResponse.json({ success: true, ...data })
  } catch (error) {
    console.error("Error updating user preferences:", error)

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: error.issues[0].message },
        { status: 400 }
      )
    }

    return NextResponse.json(
      { error: "Failed to update preferences" },
      { status: 500 }
    )
  }
}
