import { NextRequest, NextResponse } from "next/server"
import { randomBytes } from "crypto"
import { prisma } from "@/lib/prisma"
import { sendVerificationEmail } from "@/lib/email"
import { z } from "zod"

const resendSchema = z.object({
  email: z.string().email("Invalid email address"),
})

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { email } = resendSchema.parse(body)

    // Find the user
    const user = await prisma.user.findUnique({
      where: { email: email.toLowerCase() },
    })

    if (!user) {
      return NextResponse.json(
        { error: "No account found with this email" },
        { status: 404 }
      )
    }

    if (user.emailVerified) {
      return NextResponse.json(
        { error: "This email is already verified" },
        { status: 400 }
      )
    }

    // Generate new verification token
    const verificationToken = randomBytes(32).toString("hex")
    const verificationExpiry = new Date(Date.now() + 24 * 60 * 60 * 1000) // 24 hours

    // Update user with new token
    await prisma.user.update({
      where: { id: user.id },
      data: {
        verificationToken,
        verificationExpiry,
      },
    })

    // Send verification email
    const { success, error } = await sendVerificationEmail(
      user.email,
      verificationToken
    )

    if (!success) {
      console.error("Failed to send verification email:", error)
      return NextResponse.json(
        { error: "Failed to send verification email. Please try again later." },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      message: "Verification email sent successfully",
    })
  } catch (error) {
    console.error("Resend verification error:", error)

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: error.issues[0].message },
        { status: 400 }
      )
    }

    return NextResponse.json(
      { error: "An error occurred while resending verification email" },
      { status: 500 }
    )
  }
}
