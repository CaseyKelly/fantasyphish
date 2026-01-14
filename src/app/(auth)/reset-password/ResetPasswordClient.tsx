"use client"

import { useState, useEffect, Suspense } from "react"
import { useSearchParams, useRouter } from "next/navigation"
import Link from "next/link"
import { Lock, AlertCircle, CheckCircle, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { DonutLogo } from "@/components/DonutLogo"

function ResetPasswordForm() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const [password, setPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [error, setError] = useState("")
  const [success, setSuccess] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [token, setToken] = useState<string | null>(null)

  useEffect(() => {
    const tokenParam = searchParams.get("token")
    if (!tokenParam) {
      setError("Invalid reset link. Please request a new password reset.")
    }
    setToken(tokenParam)
  }, [searchParams])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError("")

    if (password !== confirmPassword) {
      setError("Passwords do not match")
      return
    }

    if (!token) {
      setError("Invalid reset link")
      return
    }

    setIsLoading(true)

    try {
      const response = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, password }),
      })

      const data = await response.json()

      if (!response.ok) {
        setError(data.error || "An error occurred")
      } else {
        setSuccess(true)
        // Redirect to login after 2 seconds
        setTimeout(() => {
          router.push("/login")
        }, 2000)
      }
    } catch {
      setError("An unexpected error occurred")
    } finally {
      setIsLoading(false)
    }
  }

  if (!token && error) {
    return (
      <Card>
        <CardContent className="py-12">
          <div className="text-center space-y-4">
            <AlertCircle className="h-12 w-12 text-[#d64545] mx-auto" />
            <div>
              <p className="text-white font-medium">{error}</p>
              <Link
                href="/forgot-password"
                className="text-[#c23a3a] hover:text-[#d64545] font-medium text-sm mt-4 inline-block"
              >
                Request a new reset link
              </Link>
            </div>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <h1 className="text-2xl font-bold text-white text-center">
          Set new password
        </h1>
        <p className="text-gray-400 text-center">
          Enter your new password below
        </p>
      </CardHeader>
      <CardContent>
        {success ? (
          <div className="space-y-6">
            <div className="p-4 bg-green-500/20 border border-green-500/30 rounded-lg flex items-start space-x-3">
              <CheckCircle className="h-5 w-5 text-green-400 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-sm text-green-400 font-medium">
                  Password reset successful!
                </p>
                <p className="text-sm text-green-400/80 mt-1">
                  Redirecting you to login...
                </p>
              </div>
            </div>
          </div>
        ) : (
          <>
            {error && (
              <div className="mb-6 p-4 bg-[#c23a3a]/20 border border-[#c23a3a]/30 rounded-lg flex items-start space-x-3">
                <AlertCircle className="h-5 w-5 text-[#d64545] flex-shrink-0 mt-0.5" />
                <p className="text-sm text-[#d64545]">{error}</p>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
                <Input
                  type="password"
                  placeholder="New password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="pl-10"
                  required
                  minLength={8}
                />
              </div>

              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
                <Input
                  type="password"
                  placeholder="Confirm password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="pl-10"
                  required
                  minLength={8}
                />
              </div>

              <p className="text-xs text-gray-400">
                Password must be at least 8 characters long
              </p>

              <Button
                type="submit"
                className="w-full"
                size="lg"
                isLoading={isLoading}
              >
                Reset password
              </Button>
            </form>

            <p className="mt-6 text-center text-sm text-gray-400">
              Remember your password?{" "}
              <Link
                href="/login"
                className="text-[#c23a3a] hover:text-[#d64545] font-medium"
              >
                Sign in
              </Link>
            </p>
          </>
        )}
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

export default function ResetPasswordClient() {
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
          <ResetPasswordForm />
        </Suspense>
      </div>
    </div>
  )
}
