"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
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
  emailVerified,
}: {
  initialEmailEnabled: boolean
  emailVerified: boolean
}) {
  const [emailEnabled, setEmailEnabled] = useState(initialEmailEnabled)
  const [savingEmail, setSavingEmail] = useState(false)

  const [pushAvailable, setPushAvailable] = useState(false)
  const [pushEnabled, setPushEnabled] = useState(false)
  const [savingPush, setSavingPush] = useState(false)

  const router = useRouter()

  useEffect(() => {
    if (!isPushSupported() || !isStandalonePwa()) return
    navigator.serviceWorker.ready
      .then((registration) => registration.pushManager.getSubscription())
      .then((subscription) => {
        setPushAvailable(true)
        setPushEnabled(!!subscription)
      })
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
      router.refresh()
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
      router.refresh()
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

  return (
    <Card>
      <CardHeader>
        <h2 className="text-xl font-semibold text-white">Notifications</h2>
      </CardHeader>
      <CardContent className="space-y-5">
        {emailVerified ? (
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
        ) : (
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-[#3d5a6c] rounded-lg">
              <Bell className="h-5 w-5 text-white" />
            </div>
            <div>
              <p className="font-medium text-white">Email reminders</p>
              <p className="text-sm text-gray-400">
                Verify your email to enable email reminders
              </p>
            </div>
          </div>
        )}

        <div className="pt-5 border-t border-[#3d5a6c]/50">
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
        </div>
      </CardContent>
    </Card>
  )
}
