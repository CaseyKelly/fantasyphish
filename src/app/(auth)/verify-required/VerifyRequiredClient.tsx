"use client"

import { useState, useEffect } from "react"
import { useSearchParams, useRouter } from "next/navigation"
import Link from "next/link"
import { Mail, AlertCircle, CheckCircle, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { DonutLogo } from "@/components/DonutLogo"

const COOLDOWN_SECONDS = 60

export default function VerifyRequiredClient() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const [email, setEmail] = useState("")
  const [isResending, setIsResending] = useState(false)
  const [resendSuccess, setResendSuccess] = useState(false)
  const [resendError, setResendError] = useState("")
  const [cooldownRemaining, setCooldownRemaining] = useState(0)

  useEffect(() => {
    // Get email from sessionStorage instead of URL parameter
    const storedEmail = sessionStorage.getItem("unverified-email")
    if (storedEmail) {
      setEmail(storedEmail)
    } else {
      // If no email in session, redirect to login
      router.push("/login")
    }
  }, [router])

  // Cooldown timer
  useEffect(() => {
    if (cooldownRemaining <= 0) return

    const timer = setInterval(() => {
      setCooldownRemaining((prev) => {
        if (prev <= 1) {
          return 0
        }
        return prev - 1
      })
    }, 1000)

    return () => clearInterval(timer)
  }, [cooldownRemaining])

  const handleResendEmail = async () => {
    if (!email || cooldownRemaining > 0) return

    setIsResending(true)
    setResendError("")
    setResendSuccess(false)

    try {
      const response = await fetch("/api/auth/resend-verification", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      })

      const data = await response.json()

      if (!response.ok) {
        setResendError(data.error || "Failed to resend verification email")
      } else {
        setResendSuccess(true)
        setCooldownRemaining(COOLDOWN_SECONDS)
      }
    } catch {
      setResendError("An unexpected error occurred. Please try again.")
    } finally {
      setIsResending(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-12 bg-[#2d4654]">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-8">
          <Link href="/" className="inline-flex items-center space-x-2">
            <DonutLogo size="lg" />
            <span className="text-2xl font-bold text-white">FantasyPhish</span>
          </Link>
        </div>

        <Card>
          <CardHeader>
            <div className="flex justify-center mb-4">
              <div className="bg-[#c23a3a]/20 p-4 rounded-full">
                <Mail className="h-12 w-12 text-[#c23a3a]" />
              </div>
            </div>
            <h1 className="text-2xl font-bold text-white text-center">
              Please Verify Your Email
            </h1>
            <p className="text-gray-400 text-center">
              We need to verify your email before you can sign in
            </p>
          </CardHeader>
          <CardContent>
            <div className="mb-6 p-4 bg-blue-500/20 border border-blue-500/30 rounded-lg">
              <p className="text-sm text-blue-400">
                A verification email has been sent to{" "}
                <span className="font-semibold">{email}</span>. Please check
                your inbox and click the verification link.
              </p>
            </div>

            {resendSuccess && (
              <div className="mb-6 p-4 bg-green-500/20 border border-green-500/30 rounded-lg flex items-start space-x-3">
                <CheckCircle className="h-5 w-5 text-green-400 flex-shrink-0 mt-0.5" />
                <p className="text-sm text-green-400">
                  Verification email sent successfully! Please check your inbox.
                </p>
              </div>
            )}

            {resendError && (
              <div className="mb-6 p-4 bg-[#c23a3a]/20 border border-[#c23a3a]/30 rounded-lg flex items-start space-x-3">
                <AlertCircle className="h-5 w-5 text-[#d64545] flex-shrink-0 mt-0.5" />
                <p className="text-sm text-[#d64545]">{resendError}</p>
              </div>
            )}

            <div className="space-y-4">
              <Button
                onClick={handleResendEmail}
                className="w-full"
                size="lg"
                isLoading={isResending}
                disabled={isResending || cooldownRemaining > 0}
              >
                {isResending ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Sending...
                  </>
                ) : cooldownRemaining > 0 ? (
                  `Wait ${cooldownRemaining}s to resend`
                ) : (
                  "Resend Verification Email"
                )}
              </Button>

              <div className="text-center">
                <Link
                  href="/login"
                  className="text-sm text-gray-400 hover:text-gray-300"
                >
                  Back to Login
                </Link>
              </div>
            </div>

            <div className="mt-6 pt-6 border-t border-gray-700">
              <p className="text-sm text-gray-400 text-center">
                Having trouble? Make sure to check your spam folder.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
