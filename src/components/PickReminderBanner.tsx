"use client"

import { useState } from "react"
import { Bell, X } from "lucide-react"

export function PickReminderBanner() {
  const [dismissed, setDismissed] = useState(false)
  const [dismissing, setDismissing] = useState(false)

  if (dismissed) {
    return null
  }

  async function handleDismiss() {
    setDismissing(true)
    setDismissed(true) // optimistic - don't block the user on the network

    try {
      const res = await fetch("/api/user/preferences", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ dismissedRemindersBanner: true }),
      })

      if (!res.ok) {
        throw new Error("Failed to save dismissal")
      }
    } catch {
      // Not worth surfacing to the user - it'll just show again next visit
    } finally {
      setDismissing(false)
    }
  }

  return (
    <div className="flex items-center gap-3 rounded-xl border-2 border-[#c23a3a]/60 bg-[#c23a3a]/10 px-4 py-3">
      <Bell className="h-5 w-5 flex-shrink-0 text-[#c23a3a]" />
      <p className="flex-1 text-sm text-gray-200">
        <span className="font-semibold text-white">New:</span> you can now opt
        in to an email reminder on show days if you haven&apos;t submitted your
        picks yet. Look for the toggle below.
      </p>
      <button
        onClick={handleDismiss}
        disabled={dismissing}
        aria-label="Dismiss"
        className="flex-shrink-0 rounded p-1 text-gray-400 hover:text-white disabled:opacity-50"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  )
}
