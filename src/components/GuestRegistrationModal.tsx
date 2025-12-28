"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { signIn } from "next-auth/react"
import { toast } from "sonner"
import { X, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardHeader } from "@/components/ui/card"

interface Pick {
  songId: string
  songName: string
  pickType: "OPENER" | "ENCORE" | "REGULAR"
}

interface GuestRegistrationModalProps {
  showId: string
  picks: Pick[]
  onClose: () => void
}

export function GuestRegistrationModal({
  showId,
  picks,
  onClose,
}: GuestRegistrationModalProps) {
  const router = useRouter()
  const [mode, setMode] = useState<"register" | "signin">("register")
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [formData, setFormData] = useState({
    email: "",
    username: "",
    password: "",
    confirmPassword: "",
  })

  // Prevent background scroll when modal is open
  useEffect(() => {
    document.body.style.overflow = "hidden"

    return () => {
      document.body.style.overflow = ""
    }
  }, [])

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSubmitting(true)

    try {
      // First, check if user exists and is verified
      const checkResponse = await fetch("/api/auth/check-user", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: formData.email }),
      })

      const checkData = await checkResponse.json()

      if (!checkData.exists) {
        toast.error("No account found with this email")
        setIsSubmitting(false)
        return
      }

      if (!checkData.verified) {
        toast.error("Please verify your email before logging in")
        setIsSubmitting(false)
        return
      }

      // Sign in
      const result = await signIn("credentials", {
        email: formData.email,
        password: formData.password,
        redirect: false,
      })

      if (result?.error) {
        toast.error("Incorrect password")
        setIsSubmitting(false)
        return
      }

      // Now submit picks
      const picksResponse = await fetch("/api/picks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          showId,
          picks: picks.map((p) => ({
            songId: p.songId,
            pickType: p.pickType,
          })),
        }),
      })

      if (!picksResponse.ok) {
        toast.error("Failed to save picks")
      } else {
        const data = await picksResponse.json()
        if (data.isUpdate) {
          toast.success("Picks updated successfully!")
        } else {
          toast.success("Picks saved successfully!")
        }
        router.push("/picks")
        router.refresh()
      }
    } catch (error) {
      console.error("Error during guest sign-in and pick submission:", error)
      toast.error("An unexpected error occurred")
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault()

    if (formData.password !== formData.confirmPassword) {
      toast.error("Passwords do not match")
      return
    }

    if (formData.password.length < 8) {
      toast.error("Password must be at least 8 characters")
      return
    }

    setIsSubmitting(true)

    try {
      // Create account and submit picks in one go
      const response = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: formData.email,
          username: formData.username,
          password: formData.password,
          showId,
          picks: picks.map((p) => ({
            songId: p.songId,
            pickType: p.pickType,
          })),
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        toast.error(data.error || "Failed to create account")
      } else {
        toast.success("Account created and picks submitted!")
        router.push("/login?registered=true")
      }
    } catch (error) {
      console.error("Error during guest registration:", error)
      toast.error("An unexpected error occurred")
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <Card className="w-full max-w-md bg-[#1e3340] border-[#3d5a6c]">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-2xl font-bold text-white">
                {mode === "register"
                  ? "Create Your Account"
                  : "Sign In to Save Picks"}
              </h2>
              <p className="text-gray-400 mt-1">
                {mode === "register"
                  ? "Save your picks and join the game"
                  : "Log in to save your picks"}
              </p>
            </div>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-white transition-colors"
            >
              <X className="h-6 w-6" />
            </button>
          </div>
        </CardHeader>
        <CardContent>
          {mode === "register" ? (
            <form onSubmit={handleRegister} className="space-y-4">
              <div>
                <label
                  htmlFor="email"
                  className="block text-sm font-medium text-gray-300 mb-1"
                >
                  Email
                </label>
                <Input
                  id="email"
                  type="email"
                  required
                  value={formData.email}
                  onChange={(e) =>
                    setFormData({ ...formData, email: e.target.value })
                  }
                  placeholder="you@example.com"
                />
              </div>

              <div>
                <label
                  htmlFor="username"
                  className="block text-sm font-medium text-gray-300 mb-1"
                >
                  Username
                </label>
                <Input
                  id="username"
                  type="text"
                  required
                  value={formData.username}
                  onChange={(e) =>
                    setFormData({ ...formData, username: e.target.value })
                  }
                  placeholder="wook123"
                />
              </div>

              <div>
                <label
                  htmlFor="password"
                  className="block text-sm font-medium text-gray-300 mb-1"
                >
                  Password
                </label>
                <Input
                  id="password"
                  type="password"
                  required
                  value={formData.password}
                  onChange={(e) =>
                    setFormData({ ...formData, password: e.target.value })
                  }
                  placeholder="At least 8 characters"
                />
              </div>

              <div>
                <label
                  htmlFor="confirmPassword"
                  className="block text-sm font-medium text-gray-300 mb-1"
                >
                  Confirm Password
                </label>
                <Input
                  id="confirmPassword"
                  type="password"
                  required
                  value={formData.confirmPassword}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      confirmPassword: e.target.value,
                    })
                  }
                  placeholder="Re-enter your password"
                />
              </div>

              <div className="pt-4">
                <Button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full"
                  size="lg"
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                      Creating Account...
                    </>
                  ) : (
                    "Create Account & Submit Picks"
                  )}
                </Button>
              </div>

              <div className="text-center">
                <button
                  type="button"
                  onClick={() => setMode("signin")}
                  className="text-sm text-[#c23a3a] hover:text-[#d64545] transition-colors"
                >
                  Already have an account? Sign in
                </button>
              </div>
            </form>
          ) : (
            <form onSubmit={handleSignIn} className="space-y-4">
              <div>
                <label
                  htmlFor="signin-email"
                  className="block text-sm font-medium text-gray-300 mb-1"
                >
                  Email
                </label>
                <Input
                  id="signin-email"
                  type="email"
                  required
                  value={formData.email}
                  onChange={(e) =>
                    setFormData({ ...formData, email: e.target.value })
                  }
                  placeholder="you@example.com"
                />
              </div>

              <div>
                <label
                  htmlFor="signin-password"
                  className="block text-sm font-medium text-gray-300 mb-1"
                >
                  Password
                </label>
                <Input
                  id="signin-password"
                  type="password"
                  required
                  value={formData.password}
                  onChange={(e) =>
                    setFormData({ ...formData, password: e.target.value })
                  }
                  placeholder="Your password"
                />
              </div>

              <div className="pt-4">
                <Button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full"
                  size="lg"
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                      Signing In...
                    </>
                  ) : (
                    "Sign In & Save Picks"
                  )}
                </Button>
              </div>

              <div className="text-center">
                <button
                  type="button"
                  onClick={() => setMode("register")}
                  className="text-sm text-[#c23a3a] hover:text-[#d64545] transition-colors"
                >
                  Don&apos;t have an account? Create one
                </button>
              </div>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
