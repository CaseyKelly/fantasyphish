"use client"

import { useSession } from "next-auth/react"
import { AlertCircle, X } from "lucide-react"
import { useState } from "react"
import { toast } from "sonner"

export function ImpersonationBanner() {
  const { data: session, update } = useSession()
  const [isLoading, setIsLoading] = useState(false)

  if (!session?.impersonating) {
    return null
  }

  const handleStopImpersonation = async () => {
    setIsLoading(true)
    try {
      const response = await fetch("/api/admin/stop-impersonate", {
        method: "POST",
      })

      if (!response.ok) {
        throw new Error("Failed to stop impersonation")
      }

      // Update the session to trigger the JWT callback
      await update({
        stopImpersonating: true,
      })

      // Force a full page reload to refresh the session with the restored JWT token
      // This is necessary because NextAuth stores the session in an HTTP-only cookie
      // and we need to trigger a complete session refresh to restore the admin user
      window.location.reload()
    } catch (error) {
      console.error("Failed to stop impersonation:", error)
      toast.error("Failed to stop impersonation. Please try again.")
      setIsLoading(false)
    }
  }

  return (
    <div className="bg-amber-500 text-amber-950 px-4 py-2 flex items-center justify-between">
      <div className="flex items-center gap-2 flex-1">
        <AlertCircle className="h-5 w-5 flex-shrink-0" />
        <p className="text-sm font-medium">
          Impersonating user:{" "}
          <span className="font-bold">{session.user.username}</span> (
          {session.user.email})
        </p>
      </div>
      <button
        onClick={handleStopImpersonation}
        disabled={isLoading}
        className="flex items-center gap-2 px-3 py-1 bg-amber-950 text-amber-100 rounded hover:bg-amber-900 transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium"
      >
        <X className="h-4 w-4" />
        <span>{isLoading ? "Stopping..." : "Stop Impersonating"}</span>
      </button>
    </div>
  )
}
