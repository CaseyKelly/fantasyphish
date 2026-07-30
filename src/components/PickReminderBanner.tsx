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
    <div className="bg-[#c23a3a]/15 border-b-2 border-[#c23a3a]/40 px-4 py-2">
      <div className="max-w-7xl mx-auto flex items-center gap-3">
        <Bell className="h-4 w-4 flex-shrink-0 text-[#c23a3a]" />
        <p className="flex-1 text-sm text-gray-200">
          <strong className="font-semibold text-white">New: </strong>
          You can now opt in to an email reminder on show days if you
          haven&apos;t submitted your picks yet &mdash; check your profile page.
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
    </div>
  )
}
