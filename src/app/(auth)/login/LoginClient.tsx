"use client"

import { useState, useEffect, Suspense } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import Link from "next/link"
import { Mail, Lock, AlertCircle } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { DonutLogo } from "@/components/DonutLogo"
import { LoadingDonut } from "@/components/LoadingDonut"
import { signInWithRetry } from "@/lib/auth-client"

// Map NextAuth error codes to friendly messages
function getErrorMessage(errorCode: string | null) {
  if (!errorCode) return ""

  // If it's already a detailed message, use it
  if (
    errorCode.length > 20 ||
    errorCode.includes("email") ||
    errorCode.includes("account")
  ) {
    return errorCode
  }

  switch (errorCode) {
    case "Configuration":
      return "No account found with this email. Please sign up first."
    case "CredentialsSignin":
      return "Invalid credentials. Please check your email and password."
    case "AccessDenied":
      return "Access denied. Please verify your email or contact support."
    default:
      return errorCode
  }
}

function LoginForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const callbackUrl = searchParams.get("callbackUrl") || "/picks"
  const verified = searchParams.get("verified")
  const authError = searchParams.get("error")

  const [email, setEmail] = useState(() =>
    typeof window === "undefined" || !verified
      ? ""
      : (sessionStorage.getItem("verified-email") ?? "")
  )
  const [password, setPassword] = useState("")
  const [error, setError] = useState(() => getErrorMessage(authError))
  const [isLoading, setIsLoading] = useState(false)

  // Clear the one-time verified-email hint and focus the password field
  // once we've auto-filled email from it.
  useEffect(() => {
    if (verified && sessionStorage.getItem("verified-email")) {
      sessionStorage.removeItem("verified-email")
      const timer = setTimeout(() => {
        document.getElementById("password-input")?.focus()
      }, 100)
      return () => clearTimeout(timer)
    }
  }, [verified])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError("")
    setIsLoading(true)

    try {
      // First, check if the user exists
      const checkResponse = await fetch("/api/auth/check-user", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      })

      const checkData = await checkResponse.json()

      if (!checkData.exists) {
        setError("No account found with this email. Please sign up first.")
        setIsLoading(false)
        return
      }

      if (!checkData.verified) {
        // Store email in sessionStorage and redirect to verification required page
        sessionStorage.setItem("unverified-email", email)
        router.push("/verify-required")
        return
      }

      // Now attempt to sign in
      const result = await signInWithRetry(email, password)

      if (result?.error) {
        setError("Incorrect password. Please try again.")
      } else {
        router.push(callbackUrl)
        router.refresh()
      }
    } catch {
      setError("An unexpected error occurred")
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <Card>
      <CardHeader>
        <h1 className="text-2xl font-bold font-display text-white text-center">
          Welcome back
        </h1>
        <p className="text-gray-300 text-center">Sign in to your account</p>
      </CardHeader>
      <CardContent>
        {verified && (
          <div
            role="status"
            className="mb-6 p-4 bg-green-500/20 border border-green-500/30 rounded-lg"
          >
            <p className="text-sm text-green-400">
              Your email has been verified! You can now log in.
            </p>
          </div>
        )}

        {error && (
          <div
            role="alert"
            className="mb-6 p-4 bg-[#c23a3a]/20 border border-[#c23a3a]/30 rounded-lg flex items-start space-x-3"
          >
            <AlertCircle
              aria-hidden="true"
              className="h-5 w-5 text-[#d64545] flex-shrink-0 mt-0.5"
            />
            <p className="text-sm text-[#d64545]">{error}</p>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="relative">
            <Mail
              aria-hidden="true"
              className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400"
            />
            <Input
              type="email"
              aria-label="Email address"
              placeholder="Email address"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="pl-10"
              required
            />
          </div>

          <div className="relative">
            <Lock
              aria-hidden="true"
              className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400"
            />
            <Input
              id="password-input"
              type="password"
              aria-label="Password"
              placeholder="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="pl-10"
              required
            />
          </div>

          <Button
            type="submit"
            className="w-full"
            size="lg"
            isLoading={isLoading}
          >
            Sign In
          </Button>
        </form>

        <p className="mt-6 text-center text-sm text-gray-300">
          Don&apos;t have an account?{" "}
          <Link
            href="/register"
            className="text-red-300 hover:text-[#d64545] font-medium"
          >
            Sign up
          </Link>
        </p>

        <p className="mt-4 text-center text-sm">
          <Link
            href="/forgot-password"
            className="text-red-300 hover:text-[#d64545] font-medium"
          >
            Forgot password?
          </Link>
        </p>
      </CardContent>
    </Card>
  )
}

function LoadingCard() {
  return (
    <Card>
      <CardContent className="py-12">
        <div className="flex items-center justify-center">
          <LoadingDonut size="sm" label="Loading…" />
        </div>
      </CardContent>
    </Card>
  )
}

export default function LoginClient() {
  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-12 bg-[#2d4654]">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-8">
          <Link href="/" className="inline-flex items-center space-x-2">
            <DonutLogo size="lg" />
            <span className="text-2xl font-bold font-display text-white">
              FantasyPhish
            </span>
          </Link>
        </div>

        <Suspense fallback={<LoadingCard />}>
          <LoginForm />
        </Suspense>
      </div>
    </div>
  )
}
