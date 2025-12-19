"use client"

import { useState, useEffect, Suspense } from "react"
import { signIn } from "next-auth/react"
import { useRouter, useSearchParams } from "next/navigation"
import Link from "next/link"
import { Mail, Lock, AlertCircle, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { DonutLogo } from "@/components/DonutLogo"

function LoginForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [error, setError] = useState("")
  const [isLoading, setIsLoading] = useState(false)

  const callbackUrl = searchParams.get("callbackUrl") || "/dashboard"
  const verified = searchParams.get("verified")
  const authError = searchParams.get("error")

  // Auto-fill email from sessionStorage if user just verified
  useEffect(() => {
    if (verified) {
      const verifiedEmail = sessionStorage.getItem("verified-email")
      if (verifiedEmail) {
        setEmail(verifiedEmail)
        sessionStorage.removeItem("verified-email")
        // Focus password field after a brief delay
        setTimeout(() => {
          document.getElementById("password-input")?.focus()
        }, 100)
      }
    }
  }, [verified])

  // Map NextAuth error codes to friendly messages
  const getErrorMessage = (errorCode: string | null) => {
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

  // Set error from URL parameter on mount
  useEffect(() => {
    if (authError) {
      setError(getErrorMessage(authError))
    }
  }, [authError])

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
        setError(
          "Please verify your email before logging in. Check your inbox for the verification link."
        )
        setIsLoading(false)
        return
      }

      // Now attempt to sign in
      const result = await signIn("credentials", {
        email,
        password,
        redirect: false,
      })

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
        <h1 className="text-2xl font-bold text-white text-center">
          Welcome back
        </h1>
        <p className="text-gray-400 text-center">Sign in to your account</p>
      </CardHeader>
      <CardContent>
        {verified && (
          <div className="mb-6 p-4 bg-green-500/20 border border-green-500/30 rounded-lg">
            <p className="text-sm text-green-400">
              Your email has been verified! You can now log in.
            </p>
          </div>
        )}

        {error && (
          <div className="mb-6 p-4 bg-[#c23a3a]/20 border border-[#c23a3a]/30 rounded-lg flex items-start space-x-3">
            <AlertCircle className="h-5 w-5 text-[#d64545] flex-shrink-0 mt-0.5" />
            <p className="text-sm text-[#d64545]">{error}</p>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="relative">
            <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
            <Input
              type="email"
              placeholder="Email address"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="pl-10"
              required
            />
          </div>

          <div className="relative">
            <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
            <Input
              id="password-input"
              type="password"
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

        <p className="mt-6 text-center text-sm text-gray-400">
          Don&apos;t have an account?{" "}
          <Link
            href="/register"
            className="text-[#c23a3a] hover:text-[#d64545] font-medium"
          >
            Sign up
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
          <Loader2 className="h-8 w-8 text-[#c23a3a] animate-spin" />
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
            <span className="text-2xl font-bold text-white">FantasyPhish</span>
          </Link>
        </div>

        <Suspense fallback={<LoadingCard />}>
          <LoginForm />
        </Suspense>
      </div>
    </div>
  )
}
