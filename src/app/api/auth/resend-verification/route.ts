import { NextRequest, NextResponse } from "next/server"
import { randomBytes } from "crypto"
import { prisma } from "@/lib/prisma"
import { sendVerificationEmail } from "@/lib/email"
import { z } from "zod"

const resendSchema = z.object({
  email: z.string().email("Invalid email address"),
})

// Simple in-memory rate limiting (resets on server restart)
// In production, consider using Redis or a database-backed solution
const rateLimitMap = new Map<string, { count: number; resetAt: number }>()
const RATE_LIMIT_WINDOW = 60 * 60 * 1000 // 1 hour in milliseconds
const MAX_REQUESTS_PER_WINDOW = 3

function getRateLimitKey(ip: string, email: string): string {
  return `${ip}:${email.toLowerCase()}`
}

function checkRateLimit(key: string): boolean {
  const now = Date.now()
  const record = rateLimitMap.get(key)

  if (!record || now > record.resetAt) {
    // No record or expired, create new
    rateLimitMap.set(key, { count: 1, resetAt: now + RATE_LIMIT_WINDOW })
    return true
  }

  if (record.count >= MAX_REQUESTS_PER_WINDOW) {
    return false
  }

  // Increment count
  record.count++
  return true
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { email } = resendSchema.parse(body)

    // Get IP address for rate limiting
    const ip =
      request.headers.get("x-forwarded-for")?.split(",")[0] ||
      request.headers.get("x-real-ip") ||
      "unknown"

    // Check rate limit
    const rateLimitKey = getRateLimitKey(ip, email)
    if (!checkRateLimit(rateLimitKey)) {
      return NextResponse.json(
        {
          error:
            "Too many verification email requests. Please try again later.",
        },
        { status: 429 }
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
