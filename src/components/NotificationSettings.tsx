"use client"

import { useEffect, useState } from "react"
import { toast } from "sonner"
import { Bell, Smartphone } from "lucide-react"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import {
  isPushSupported,
  isStandalonePwa,
  subscribeToPush,
  unsubscribeFromPush,
} from "@/lib/push-client"

export function NotificationSettings({
  initialEmailEnabled,
  isAdmin,
}: {
  initialEmailEnabled: boolean
  isAdmin: boolean
}) {
  const [emailEnabled, setEmailEnabled] = useState(initialEmailEnabled)
  const [savingEmail, setSavingEmail] = useState(false)

  const [pushAvailable, setPushAvailable] = useState(false)
  const [pushEnabled, setPushEnabled] = useState(false)
  const [savingPush, setSavingPush] = useState(false)
  const [sendingTest, setSendingTest] = useState(false)

  useEffect(() => {
    if (!isPushSupported() || !isStandalonePwa()) return
    setPushAvailable(true)
    navigator.serviceWorker.ready
      .then((registration) => registration.pushManager.getSubscription())
      .then((subscription) => setPushEnabled(!!subscription))
      .catch(() => {})
  }, [])

  async function handleEmailToggle(next: boolean) {
    setSavingEmail(true)
    try {
      const res = await fetch("/api/user/preferences", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ emailPickReminders: next }),
      })

      if (!res.ok) {
        throw new Error("Failed to save preference")
      }

      setEmailEnabled(next)
      toast.success(
        next
          ? "You'll get an email reminder on show days"
          : "Show-day email reminders turned off"
      )
    } catch {
      toast.error("Couldn't save your preference. Try again.")
    } finally {
      setSavingEmail(false)
    }
  }

  async function handlePushToggle(next: boolean) {
    setSavingPush(true)
    try {
      if (next) {
        await subscribeToPush()
        toast.success("You'll get a push notification on show days")
      } else {
        await unsubscribeFromPush()
        toast.success("Push notifications turned off")
      }
      setPushEnabled(next)
    } catch (error) {
      console.error("Push toggle failed:", error)
      toast.error(
        error instanceof Error
          ? error.message
          : "Couldn't update push notifications. Try again."
      )
    } finally {
      setSavingPush(false)
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

  return (
    <Card>
      <CardHeader>
        <h2 className="text-xl font-semibold text-white">Notifications</h2>
      </CardHeader>
      <CardContent className="space-y-4 divide-y divide-[#3d5a6c]">
        <label className="flex items-center justify-between gap-4 cursor-pointer">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-[#3d5a6c] rounded-lg">
              <Bell className="h-5 w-5 text-white" />
            </div>
            <div>
              <p className="font-medium text-white">Email reminders</p>
              <p className="text-sm text-gray-400">
                Get an email on show days if you haven&apos;t submitted picks
                yet
              </p>
            </div>
          </div>
          <input
            type="checkbox"
            checked={emailEnabled}
            disabled={savingEmail}
            onChange={(e) => handleEmailToggle(e.target.checked)}
            className="h-5 w-5 rounded border-2 border-[#4a6b7d] text-[#c23a3a] focus:ring-[#c23a3a] disabled:opacity-50"
          />
        </label>

        <div className="pt-4">
          {pushAvailable ? (
            <label className="flex items-center justify-between gap-4 cursor-pointer">
              <div className="flex items-center space-x-3">
                <div className="p-2 bg-[#3d5a6c] rounded-lg">
                  <Smartphone className="h-5 w-5 text-white" />
                </div>
                <div>
                  <p className="font-medium text-white">Push reminders</p>
                  <p className="text-sm text-gray-400">
                    Get a notification on this device on show days if you
                    haven&apos;t submitted picks yet
                  </p>
                </div>
              </div>
              <input
                type="checkbox"
                checked={pushEnabled}
                disabled={savingPush}
                onChange={(e) => handlePushToggle(e.target.checked)}
                className="h-5 w-5 rounded border-2 border-[#4a6b7d] text-[#c23a3a] focus:ring-[#c23a3a] disabled:opacity-50"
              />
            </label>
          ) : (
            <div className="flex items-center space-x-3">
              <div className="p-2 bg-[#3d5a6c] rounded-lg">
                <Smartphone className="h-5 w-5 text-white" />
              </div>
              <div>
                <p className="font-medium text-white">Push reminders</p>
                <p className="text-sm text-gray-400">
                  Install FantasyPhish to your home screen to get push
                  notifications on this device
                </p>
              </div>
            </div>
          )}

          {isAdmin && pushEnabled && (
            <button
              onClick={handleTestPush}
              disabled={sendingTest}
              className="mt-3 text-sm text-gray-300 underline hover:text-white disabled:opacity-50"
            >
              {sendingTest ? "Sending…" : "Send test notification"}
            </button>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
