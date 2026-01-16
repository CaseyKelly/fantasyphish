import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { z } from "zod"

const registerTokenSchema = z.object({
  token: z.string().min(1),
  platform: z.enum(["ios", "android"]),
})

export async function POST(request: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const body = await request.json()
    const { token, platform } = registerTokenSchema.parse(body)

    // Check if token already exists
    const existingToken = await prisma.pushToken.findUnique({
      where: { token },
    })

    if (existingToken) {
      // If token exists but belongs to different user, update it
      if (existingToken.userId !== session.user.id) {
        await prisma.pushToken.update({
          where: { token },
          data: {
            userId: session.user.id,
            platform,
            isActive: true,
            updatedAt: new Date(),
          },
        })
      } else {
        // Just mark as active and update timestamp
        await prisma.pushToken.update({
          where: { token },
          data: {
            isActive: true,
            updatedAt: new Date(),
          },
        })
      }
    } else {
      // Create new token
      await prisma.pushToken.create({
        data: {
          userId: session.user.id,
          token,
          platform,
          isActive: true,
        },
      })
    }

    // Create notification preferences if they don't exist
    const prefs = await prisma.notificationPreferences.findUnique({
      where: { userId: session.user.id },
    })

    if (!prefs) {
      await prisma.notificationPreferences.create({
        data: {
          userId: session.user.id,
          pickRemindersEnabled: true,
        },
      })
    }

    return NextResponse.json({
      success: true,
      message: "Token registered successfully",
    })
  } catch (error) {
    console.error("Error registering push token:", error)

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: error.issues[0].message },
        { status: 400 }
      )
    }

    return NextResponse.json(
      { error: "Failed to register push token" },
      { status: 500 }
    )
  }
}
