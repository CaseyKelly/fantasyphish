import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { z } from "zod"

const unregisterTokenSchema = z.object({
  token: z.string().min(1),
})

export async function DELETE(request: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const body = await request.json()
    const { token } = unregisterTokenSchema.parse(body)

    // Mark token as inactive (don't delete for audit trail)
    await prisma.pushToken.updateMany({
      where: {
        token,
        userId: session.user.id,
      },
      data: {
        isActive: false,
      },
    })

    return NextResponse.json({
      success: true,
      message: "Token unregistered successfully",
    })
  } catch (error) {
    console.error("Error unregistering push token:", error)

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: error.issues[0].message },
        { status: 400 }
      )
    }

    return NextResponse.json(
      { error: "Failed to unregister push token" },
      { status: 500 }
    )
  }
}
