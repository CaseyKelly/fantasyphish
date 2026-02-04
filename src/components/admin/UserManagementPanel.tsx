"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"

type UserSearchResult = {
  id: string
  username: string
  email: string
  isAdmin: boolean
  createdAt: string
  _count?: {
    pushTokens: number
  }
  notificationPreferences?: {
    pickRemindersEnabled: boolean
  }
}

export function UserManagementPanel() {
  const router = useRouter()
  const [searchQuery, setSearchQuery] = useState("")
  const [searchResults, setSearchResults] = useState<UserSearchResult[]>([])
  const [searching, setSearching] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [impersonating, setImpersonating] = useState(false)

  async function handleSearch(e: React.FormEvent) {
    e.preventDefault()
    if (!searchQuery.trim()) return

    setSearching(true)
    setError(null)

    try {
      const response = await fetch(
        `/api/admin/users?search=${encodeURIComponent(searchQuery)}`
      )

      if (!response.ok) {
        throw new Error("Failed to search users")
      }

      const data = await response.json()
      setSearchResults(data.users || [])
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to search users")
    } finally {
      setSearching(false)
    }
  }

  async function handleImpersonate(userId: string, username: string) {
    if (
      !confirm(
        `Impersonate ${username}? This will switch your session to their account.`
      )
    ) {
      return
    }

    setImpersonating(true)
    setError(null)

    try {
      const response = await fetch("/api/admin/impersonate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId }),
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || "Failed to impersonate user")
      }

      // Refresh the page to update the session
      router.refresh()
      alert(
        `Now impersonating ${username}. Use the banner at the top to stop impersonating.`
      )
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to impersonate user"
      )
    } finally {
      setImpersonating(false)
    }
  }

  return (
    <div className="bg-surface border border-neutral-700 rounded-lg p-6">
      <h2 className="text-2xl font-bold mb-6">User Management</h2>

      {/* Search Form */}
      <form onSubmit={handleSearch} className="mb-6">
        <div className="flex gap-2">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by username or email..."
            className="flex-1 px-4 py-2 bg-neutral-800 border border-neutral-700 rounded-lg focus:outline-none focus:border-accent"
          />
          <button
            type="submit"
            disabled={searching}
            className="bg-accent hover:bg-accent/90 disabled:bg-neutral-700 disabled:text-neutral-400 text-black font-semibold py-2 px-6 rounded-lg transition-colors"
          >
            {searching ? "Searching..." : "Search"}
          </button>
        </div>
      </form>

      {error && (
        <div className="bg-red-900/20 border border-red-700 rounded-lg p-3 text-red-400 text-sm mb-4">
          {error}
        </div>
      )}

      {/* Search Results */}
      {searchResults.length > 0 && (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-neutral-700">
                <th className="text-left py-3 px-2">Username</th>
                <th className="text-left py-3 px-2">Email</th>
                <th className="text-left py-3 px-2">Joined</th>
                <th className="text-left py-3 px-2">Push Tokens</th>
                <th className="text-left py-3 px-2">Notifications</th>
                <th className="text-left py-3 px-2">Actions</th>
              </tr>
            </thead>
            <tbody>
              {searchResults.map((user) => (
                <tr key={user.id} className="border-b border-neutral-800">
                  <td className="py-3 px-2 font-medium">
                    {user.username}
                    {user.isAdmin && (
                      <span className="ml-2 text-xs bg-accent/20 text-accent px-2 py-0.5 rounded">
                        Admin
                      </span>
                    )}
                  </td>
                  <td className="py-3 px-2 text-neutral-400">{user.email}</td>
                  <td className="py-3 px-2 text-neutral-400">
                    {new Date(user.createdAt).toLocaleDateString()}
                  </td>
                  <td className="py-3 px-2">
                    <span className="text-xs bg-neutral-800 px-2 py-1 rounded">
                      {user._count?.pushTokens ?? 0} active
                    </span>
                  </td>
                  <td className="py-3 px-2">
                    {user.notificationPreferences?.pickRemindersEnabled ? (
                      <span className="text-green-400 text-xs">✓ Enabled</span>
                    ) : (
                      <span className="text-neutral-500 text-xs">Disabled</span>
                    )}
                  </td>
                  <td className="py-3 px-2">
                    <button
                      onClick={() => handleImpersonate(user.id, user.username)}
                      disabled={impersonating}
                      className="text-xs bg-neutral-700 hover:bg-neutral-600 disabled:bg-neutral-800 disabled:text-neutral-500 px-3 py-1.5 rounded transition-colors"
                    >
                      Impersonate
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {searchResults.length === 0 && searchQuery && !searching && (
        <div className="text-center py-8 text-neutral-400">
          No users found matching &quot;{searchQuery}&quot;
        </div>
      )}
    </div>
  )
}
