"use client"

import { useEffect, useState } from "react"
import { useSession } from "next-auth/react"
import { toast } from "sonner"
import { Users } from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"
import { LoadingDonut } from "@/components/LoadingDonut"

type UserForImpersonation = {
  id: string
  username: string
  email: string
  isAdmin: boolean
}

export default function ImpersonateClient() {
  const { update } = useSession()
  const [users, setUsers] = useState<UserForImpersonation[]>([])
  const [loadingUsers, setLoadingUsers] = useState(true)
  const [impersonating, setImpersonating] = useState(false)
  const [impersonateRedirect, setImpersonateRedirect] = useState(false)

  useEffect(() => {
    if (impersonateRedirect) {
      // Force a full page reload to refresh the session with the new JWT token
      // (NextAuth stores the session in an HTTP-only cookie, so a client-side
      // route change alone won't pick up the new token) and land somewhere
      // useful now that we're viewing the app as the impersonated user.
      window.location.href = "/picks"
    }
  }, [impersonateRedirect])

  useEffect(() => {
    const loadUsers = async () => {
      try {
        const response = await fetch("/api/admin/users")
        if (response.ok) {
          const data = await response.json()
          setUsers(data.users)
        }
      } catch (error) {
        console.error("Failed to load users:", error)
      } finally {
        setLoadingUsers(false)
      }
    }

    loadUsers()
  }, [])

  const handleImpersonate = async (userId: string) => {
    setImpersonating(true)
    try {
      const response = await fetch("/api/admin/impersonate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId }),
      })

      if (!response.ok) {
        throw new Error("Failed to impersonate user")
      }

      const data = await response.json()

      // Update the session with impersonation data
      await update({
        impersonating: {
          originalUserId: data.impersonation.originalUserId,
          originalUsername: data.impersonation.originalUsername,
          originalIsAdmin: data.impersonation.originalIsAdmin,
          targetUserId: data.impersonation.targetUser.id,
          targetUsername: data.impersonation.targetUser.username,
          targetEmail: data.impersonation.targetUser.email,
          targetIsAdmin: data.impersonation.targetUser.isAdmin,
        },
      })

      setImpersonateRedirect(true)
    } catch (error) {
      console.error("Failed to impersonate:", error)
      toast.error("Failed to impersonate user. Please try again.")
      setImpersonating(false)
    }
  }

  return (
    <Card>
      <CardContent>
        {loadingUsers ? (
          <div className="flex justify-center py-8">
            <LoadingDonut size="sm" label="Loading users…" />
          </div>
        ) : users.length === 0 ? (
          <p className="text-gray-400 text-center py-4">No users found</p>
        ) : (
          <div className="space-y-2">
            {users.map((user) => (
              <button
                key={user.id}
                onClick={() => handleImpersonate(user.id)}
                disabled={impersonating}
                className="w-full flex items-center justify-between p-4 rounded-lg bg-[#3d5a6c]/30 hover:bg-[#3d5a6c]/50 transition-colors text-left disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <div>
                  <p className="font-medium text-white">
                    {user.username}
                    {user.isAdmin && (
                      <span className="ml-2 text-xs text-amber-400">
                        (Admin)
                      </span>
                    )}
                  </p>
                  <p className="text-sm text-gray-400">{user.email}</p>
                </div>
                <Users className="h-5 w-5 text-gray-400" />
              </button>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
