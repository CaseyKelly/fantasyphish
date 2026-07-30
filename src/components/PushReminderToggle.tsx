"use client"

import { useEffect, useState } from "react"
import { toast } from "sonner"
import { Bell } from "lucide-react"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import {
  isPushSupported,
  subscribeToPush,
  unsubscribeFromPush,
} from "@/lib/push-client"

export function PushReminderToggle({ isAdmin }: { isAdmin: boolean }) {
  const [supported, setSupported] = useState(false)
  const [enabled, setEnabled] = useState(false)
  const [saving, setSaving] = useState(false)
  const [sendingTest, setSendingTest] = useState(false)

  useEffect(() => {
    if (!isPushSupported()) return
    setSupported(true)
    navigator.serviceWorker.ready
      .then((registration) => registration.pushManager.getSubscription())
      .then((subscription) => setEnabled(!!subscription))
      .catch(() => {})
  }, [])

  async function handleToggle(next: boolean) {
    setSaving(true)
    try {
      if (next) {
        await subscribeToPush()
        toast.success("You'll get a push notification on show days")
      } else {
        await unsubscribeFromPush()
        toast.success("Push notifications turned off")
      }
      setEnabled(next)
    } catch {
      toast.error("Couldn't update push notifications. Try again.")
    } finally {
      setSaving(false)
    }
  }

  async function handleTestPush() {
    setSendingTest(true)
    try {
      const res = await fetch("/api/admin/test-push", { method: "POST" })
      const data = await res.json()

      if (!res.ok) {
        throw new Error(data.error || "Test push failed")
      }

      toast.success(
        `Test notification sent (${data.sent} sent, ${data.failed} failed)`
      )
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Couldn't send test push"
      )
    } finally {
      setSendingTest(false)
    }
  }

  if (!supported) return null

  return (
    <Card>
      <CardHeader>
        <h2 className="text-xl font-semibold text-white">Push Notifications</h2>
      </CardHeader>
      <CardContent className="space-y-4">
        <label className="flex items-center justify-between gap-4 cursor-pointer">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-[#3d5a6c] rounded-lg">
              <Bell className="h-5 w-5 text-white" />
            </div>
            <div>
              <p className="font-medium text-white">Show-day push reminders</p>
              <p className="text-sm text-gray-400">
                Get a notification on this device on show days if you
                haven&apos;t submitted picks yet
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

        {isAdmin && enabled && (
          <button
            onClick={handleTestPush}
            disabled={sendingTest}
            className="text-sm text-gray-300 underline hover:text-white disabled:opacity-50"
          >
            {sendingTest ? "Sending…" : "Send test notification"}
          </button>
        )}
      </CardContent>
    </Card>
  )
}
