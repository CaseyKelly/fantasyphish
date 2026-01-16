"use client"

import { useState, useEffect } from "react"

type NotificationStats = {
  totalActiveTokens: number
  usersWithNotificationsEnabled: number
  todayNotifications: number
}

type NotificationLog = {
  id: string
  type: string
  title: string
  body: string
  success: boolean
  error: string | null
  sentAt: Date
  user: {
    username: string
    email: string
  }
  show: {
    venue: string
    showDate: Date
  } | null
}

export function PushNotificationsPanel() {
  const [stats, setStats] = useState<NotificationStats | null>(null)
  const [logs, setLogs] = useState<NotificationLog[]>([])
  const [loading, setLoading] = useState(true)
  const [sending, setSending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [formData, setFormData] = useState({
    title: "",
    body: "",
    target: "all",
    showId: "",
    testMode: true,
  })

  useEffect(() => {
    loadData()
  }, [])

  async function loadData() {
    try {
      setLoading(true)
      const [statsRes, logsRes] = await Promise.all([
        fetch("/api/admin/notification-stats"),
        fetch("/api/admin/notification-logs?limit=20"),
      ])

      const statsData = await statsRes.json()
      const logsData = await logsRes.json()

      setStats(statsData)
      setLogs(logsData.logs)
    } catch (err) {
      setError("Failed to load notification data")
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  async function handleSendNotification(e: React.FormEvent) {
    e.preventDefault()
    setSending(true)
    setError(null)

    try {
      const response = await fetch("/api/admin/send-notification", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || "Failed to send notification")
      }

      alert(`Notification sent successfully! Sent to ${data.sent} users.`)

      // Reset form
      setFormData({
        title: "",
        body: "",
        target: "all",
        showId: "",
        testMode: true,
      })

      // Reload data
      loadData()
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to send notification"
      )
    } finally {
      setSending(false)
    }
  }

  if (loading) {
    return (
      <div className="bg-surface border border-neutral-700 rounded-lg p-6">
        <h2 className="text-2xl font-bold mb-4">Push Notifications</h2>
        <div className="text-center py-8 text-neutral-400">Loading...</div>
      </div>
    )
  }

  return (
    <div className="bg-surface border border-neutral-700 rounded-lg p-6">
      <h2 className="text-2xl font-bold mb-6">Push Notifications</h2>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
        <div className="bg-neutral-800 border border-neutral-700 rounded-lg p-4">
          <div className="text-sm text-neutral-400">Active Tokens</div>
          <div className="text-3xl font-bold text-accent mt-1">
            {stats?.totalActiveTokens ?? 0}
          </div>
        </div>
        <div className="bg-neutral-800 border border-neutral-700 rounded-lg p-4">
          <div className="text-sm text-neutral-400">Enabled Users</div>
          <div className="text-3xl font-bold text-accent mt-1">
            {stats?.usersWithNotificationsEnabled ?? 0}
          </div>
        </div>
        <div className="bg-neutral-800 border border-neutral-700 rounded-lg p-4">
          <div className="text-sm text-neutral-400">Sent Today</div>
          <div className="text-3xl font-bold text-accent mt-1">
            {stats?.todayNotifications ?? 0}
          </div>
        </div>
      </div>

      {/* Send Notification Form */}
      <div className="mb-8">
        <h3 className="text-xl font-semibold mb-4">Send Manual Notification</h3>
        <form onSubmit={handleSendNotification} className="space-y-4">
          <div>
            <label htmlFor="title" className="block text-sm font-medium mb-2">
              Title
            </label>
            <input
              type="text"
              id="title"
              value={formData.title}
              onChange={(e) =>
                setFormData({ ...formData, title: e.target.value })
              }
              className="w-full px-4 py-2 bg-neutral-800 border border-neutral-700 rounded-lg focus:outline-none focus:border-accent"
              required
              placeholder="Notification title"
            />
          </div>

          <div>
            <label htmlFor="body" className="block text-sm font-medium mb-2">
              Message
            </label>
            <textarea
              id="body"
              value={formData.body}
              onChange={(e) =>
                setFormData({ ...formData, body: e.target.value })
              }
              className="w-full px-4 py-2 bg-neutral-800 border border-neutral-700 rounded-lg focus:outline-none focus:border-accent"
              required
              rows={3}
              placeholder="Notification message"
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label
                htmlFor="target"
                className="block text-sm font-medium mb-2"
              >
                Target
              </label>
              <select
                id="target"
                value={formData.target}
                onChange={(e) =>
                  setFormData({ ...formData, target: e.target.value })
                }
                className="w-full px-4 py-2 bg-neutral-800 border border-neutral-700 rounded-lg focus:outline-none focus:border-accent"
              >
                <option value="all">All Users</option>
                <option value="show">Show Participants</option>
              </select>
            </div>

            {formData.target === "show" && (
              <div>
                <label
                  htmlFor="showId"
                  className="block text-sm font-medium mb-2"
                >
                  Show ID
                </label>
                <input
                  type="text"
                  id="showId"
                  value={formData.showId}
                  onChange={(e) =>
                    setFormData({ ...formData, showId: e.target.value })
                  }
                  className="w-full px-4 py-2 bg-neutral-800 border border-neutral-700 rounded-lg focus:outline-none focus:border-accent"
                  placeholder="Show ID"
                  required={formData.target === "show"}
                />
              </div>
            )}
          </div>

          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="testMode"
              checked={formData.testMode}
              onChange={(e) =>
                setFormData({ ...formData, testMode: e.target.checked })
              }
              className="w-4 h-4 bg-neutral-800 border-neutral-700 rounded focus:ring-accent"
            />
            <label htmlFor="testMode" className="text-sm">
              Test Mode (only send to admins)
            </label>
          </div>

          {error && (
            <div className="bg-red-900/20 border border-red-700 rounded-lg p-3 text-red-400 text-sm">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={sending}
            className="w-full bg-accent hover:bg-accent/90 disabled:bg-neutral-700 disabled:text-neutral-400 text-black font-semibold py-3 px-6 rounded-lg transition-colors"
          >
            {sending ? "Sending..." : "Send Notification"}
          </button>
        </form>
      </div>

      {/* Recent Notification Logs */}
      <div>
        <h3 className="text-xl font-semibold mb-4">Recent Notifications</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-neutral-700">
                <th className="text-left py-3 px-2">Time</th>
                <th className="text-left py-3 px-2">User</th>
                <th className="text-left py-3 px-2">Type</th>
                <th className="text-left py-3 px-2">Title</th>
                <th className="text-left py-3 px-2">Status</th>
              </tr>
            </thead>
            <tbody>
              {logs.length === 0 ? (
                <tr>
                  <td colSpan={5} className="text-center py-8 text-neutral-400">
                    No notifications sent yet
                  </td>
                </tr>
              ) : (
                logs.map((log) => (
                  <tr key={log.id} className="border-b border-neutral-800">
                    <td className="py-3 px-2 text-neutral-400">
                      {new Date(log.sentAt).toLocaleString()}
                    </td>
                    <td className="py-3 px-2">{log.user.username}</td>
                    <td className="py-3 px-2">
                      <span className="text-xs bg-neutral-800 px-2 py-1 rounded">
                        {log.type}
                      </span>
                    </td>
                    <td className="py-3 px-2">{log.title}</td>
                    <td className="py-3 px-2">
                      {log.success ? (
                        <span className="text-green-400">✓ Sent</span>
                      ) : (
                        <span
                          className="text-red-400"
                          title={log.error ?? undefined}
                        >
                          ✗ Failed
                        </span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
