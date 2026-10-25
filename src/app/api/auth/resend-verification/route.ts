import { NextRequest, NextResponse } from "next/server"
import { randomBytes } from "crypto"
import { prisma } from "@/lib/prisma"
import { sendVerificationEmail } from "@/lib/email"
import { z } from "zod"
import {
  RATE_LIMITS,
  checkRateLimits,
  getClientIp,
  normalizeEmailKey,
  rateLimitResponse,
} from "@/lib/rate-limit"

const resendSchema = z.object({
  email: z.string().email("Invalid email address"),
})

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { email } = resendSchema.parse(body)

    const ip = getClientIp(request.headers)
    const rateLimit = await checkRateLimits([
      [RATE_LIMITS.resendVerificationIp, ip],
      [RATE_LIMITS.resendVerificationEmail, normalizeEmailKey(email)],
    ])
    if (!rateLimit.allowed) {
      return rateLimitResponse(
        rateLimit,
        "Too many verification email requests. Please try again later."
      )
    }

    // Find the user
    const user = await prisma.user.findUnique({
      where: { email: email.toLowerCase() },
    })

    // To prevent user enumeration, return a generic success message
    // regardless of whether the account exists or is already verified
    if (!user || user.emailVerified) {
      return NextResponse.json({
        success: true,
        message:
          "If an account with this email exists and is not yet verified, a verification email has been sent.",
      })
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
      // Still return success to prevent enumeration
      return NextResponse.json({
        success: true,
        message:
          "If an account with this email exists and is not yet verified, a verification email has been sent.",
      })
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
