import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { z } from "zod"

const updatePreferencesSchema = z.object({
  pickRemindersEnabled: z.boolean(),
})

// GET user's notification preferences
export async function GET() {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    let prefs = await prisma.notificationPreferences.findUnique({
      where: { userId: session.user.id },
    })

    // Create default preferences if they don't exist
    if (!prefs) {
      prefs = await prisma.notificationPreferences.create({
        data: {
          userId: session.user.id,
          pickRemindersEnabled: true,
        },
      })
    }

    return NextResponse.json({
      pickRemindersEnabled: prefs.pickRemindersEnabled,
    })
  } catch (error) {
    console.error("Error fetching notification preferences:", error)
    return NextResponse.json(
      { error: "Failed to fetch preferences" },
      { status: 500 }
    )
  }
}

// UPDATE user's notification preferences
export async function PUT(request: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const body = await request.json()
    const { pickRemindersEnabled } = updatePreferencesSchema.parse(body)

    const prefs = await prisma.notificationPreferences.upsert({
      where: { userId: session.user.id },
      update: {
        pickRemindersEnabled,
      },
      create: {
        userId: session.user.id,
        pickRemindersEnabled,
      },
    })

    return NextResponse.json({
      success: true,
      pickRemindersEnabled: prefs.pickRemindersEnabled,
    })
  } catch (error) {
    console.error("Error updating notification preferences:", error)

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
