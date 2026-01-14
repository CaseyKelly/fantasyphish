"use client"

import { useState } from "react"
import Link from "next/link"
import { Mail, AlertCircle, CheckCircle } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { DonutLogo } from "@/components/DonutLogo"

export default function ForgotPasswordClient() {
  const [email, setEmail] = useState("")
  const [error, setError] = useState("")
  const [success, setSuccess] = useState(false)
  const [isLoading, setIsLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError("")
    setSuccess(false)
    setIsLoading(true)

    try {
      const response = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      })

      const data = await response.json()

      if (!response.ok) {
        setError(data.error || "An error occurred")
      } else {
        setSuccess(true)
        setEmail("")
      }
    } catch {
      setError("An unexpected error occurred")
    } finally {
      setIsLoading(false)
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
            <h1 className="text-2xl font-bold text-white text-center">
              Reset your password
            </h1>
            <p className="text-gray-400 text-center">
              Enter your email and we&apos;ll send you a reset link
            </p>
          </CardHeader>
          <CardContent>
            {success ? (
              <div className="space-y-6">
                <div className="p-4 bg-green-500/20 border border-green-500/30 rounded-lg flex items-start space-x-3">
                  <CheckCircle className="h-5 w-5 text-green-400 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm text-green-400 font-medium">
                      Check your email
                    </p>
                    <p className="text-sm text-green-400/80 mt-1">
                      If an account exists with this email, a password reset
                      link has been sent.
                    </p>
                  </div>
                </div>

                <div className="text-center">
                  <Link
                    href="/login"
                    className="text-[#c23a3a] hover:text-[#d64545] font-medium text-sm"
                  >
                    Back to login
                  </Link>
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

                  <Button
                    type="submit"
                    className="w-full"
                    size="lg"
                    isLoading={isLoading}
                  >
                    Send reset link
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
      </div>
    </div>
  )
}
