import { NextRequest, NextResponse } from "next/server"
import { hash } from "bcryptjs"
import { randomBytes } from "crypto"
import { prisma } from "@/lib/prisma"
import { sendVerificationEmail } from "@/lib/email"
import { z } from "zod"
import { PickType } from "@prisma/client"

const registerSchema = z.object({
  email: z.string().email("Invalid email address"),
  username: z
    .string()
    .min(3, "Username must be at least 3 characters")
    .max(20, "Username must be at most 20 characters")
    .regex(
      /^[a-zA-Z0-9_]+$/,
      "Username can only contain letters, numbers, and underscores"
    ),
  password: z.string().min(8, "Password must be at least 8 characters"),
  showId: z.string().optional(),
  picks: z
    .array(
      z.object({
        songId: z.string(),
        pickType: z.enum(["OPENER", "ENCORE", "REGULAR"]),
      })
    )
    .optional(),
})

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { email, username, password, showId, picks } =
      registerSchema.parse(body)

    // Check if email already exists
    const existingEmail = await prisma.user.findUnique({
      where: { email: email.toLowerCase() },
    })

    if (existingEmail) {
      return NextResponse.json(
        { error: "An account with this email already exists" },
        { status: 400 }
      )
    }

    // Check if username already exists
    const allUsers = await prisma.user.findMany()
    const existingUsername = allUsers.find(
      (u) => u.username.toLowerCase() === username.toLowerCase()
    )

    if (existingUsername) {
      return NextResponse.json(
        { error: "This username is already taken" },
        { status: 400 }
      )
    }

    // Hash password
    const passwordHash = await hash(password, 12)

    // Generate verification token
    const verificationToken = randomBytes(32).toString("hex")
    const verificationExpiry = new Date(Date.now() + 24 * 60 * 60 * 1000) // 24 hours

    // Create user and optionally their picks in a transaction
    const result = await prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          email: email.toLowerCase(),
          username,
          passwordHash,
          verificationToken,
          verificationExpiry,
        },
      })

      let submission = null

      // If picks are provided, create submission
      if (showId && picks && picks.length === 13) {
        submission = await tx.submission.create({
          data: {
            userId: user.id,
            showId,
            picks: {
              create: picks.map((pick) => ({
                songId: pick.songId,
                pickType: pick.pickType as PickType,
              })),
            },
          },
          include: {
            picks: {
              include: { song: true },
            },
          },
        })
      }

      return { user, submission }
    })

    // Send verification email
    const { success, error } = await sendVerificationEmail(
      result.user.email,
      verificationToken
    )

    if (!success) {
      console.error("Failed to send verification email:", error)
      // Don't fail registration, but log the error
    }

    return NextResponse.json({
      success: true,
      message: result.submission
        ? "Registration successful! Your picks have been saved. Please check your email to verify your account."
        : "Registration successful! Please check your email to verify your account.",
    })
  } catch (error) {
    console.error("Registration error:", error)

    // Log more details for debugging
    if (error instanceof Error) {
      console.error("Error message:", error.message)
      console.error("Error stack:", error.stack)
    }

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: error.issues[0].message },
        { status: 400 }
      )
    }

    return NextResponse.json(
      {
        error: "An error occurred during registration",
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    )
  }
}
