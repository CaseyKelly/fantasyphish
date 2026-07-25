"use client"

import { useState } from "react"
import { toast } from "sonner"
import { Bell } from "lucide-react"
import { Card, CardContent, CardHeader } from "@/components/ui/card"

export function PickReminderToggle({
  initialEnabled,
}: {
  initialEnabled: boolean
}) {
  const [enabled, setEnabled] = useState(initialEnabled)
  const [saving, setSaving] = useState(false)

  async function handleToggle(next: boolean) {
    setSaving(true)
    try {
      const res = await fetch("/api/user/preferences", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ emailPickReminders: next }),
      })

      if (!res.ok) {
        throw new Error("Failed to save preference")
      }

      setEnabled(next)
      toast.success(
        next
          ? "You'll get an email reminder on show days"
          : "Show-day reminders turned off"
      )
    } catch {
      toast.error("Couldn't save your preference. Try again.")
    } finally {
      setSaving(false)
    }
  }

  return (
    <Card>
      <CardHeader>
        <h2 className="text-xl font-semibold text-white">Notifications</h2>
      </CardHeader>
      <CardContent>
        <label className="flex items-center justify-between gap-4 cursor-pointer">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-[#3d5a6c] rounded-lg">
              <Bell className="h-5 w-5 text-white" />
            </div>
            <div>
              <p className="font-medium text-white">Show-day pick reminders</p>
              <p className="text-sm text-gray-400">
                Get an email on show days if you haven&apos;t submitted picks
                yet
              </p>
            </div>
          </div>
          <input
            type="checkbox"
            checked={enabled}
            disabled={saving}
            onChange={(e) => handleToggle(e.target.checked)}
            className="h-5 w-5 rounded border-2 border-[#4a6b7d] text-[#c23a3a] focus:ring-[#c23a3a] disabled:opacity-50"
          />
        </label>
      </CardContent>
    </Card>
  )
}
