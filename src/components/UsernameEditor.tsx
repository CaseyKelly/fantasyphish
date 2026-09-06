"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { useSession } from "next-auth/react"
import { toast } from "sonner"
import { Pencil, Check, X } from "lucide-react"

export function UsernameEditor({ username }: { username: string }) {
  const [editing, setEditing] = useState(false)
  const [value, setValue] = useState(username)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const { update } = useSession()
  const router = useRouter()

  function startEditing() {
    setValue(username)
    setError(null)
    setEditing(true)
  }

  function cancelEditing() {
    setError(null)
    setEditing(false)
  }

  async function handleSave() {
    if (value === username) {
      setEditing(false)
      return
    }

    setSaving(true)
    setError(null)
    try {
      const res = await fetch("/api/user/username", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: value }),
      })

      const data = await res.json()

      if (!res.ok) {
        setError(data.error || "Failed to update username")
        return
      }

      await update({ username: data.username })
      toast.success("Username updated")
      setEditing(false)
      router.push(`/user/${data.username}`)
    } catch {
      setError("Failed to update username")
    } finally {
      setSaving(false)
    }
  }

  if (!editing) {
    return (
      <div className="flex items-center space-x-2">
        <p className="font-medium text-white">{username}</p>
        <button
          type="button"
          onClick={startEditing}
          aria-label="Edit username"
          className="text-gray-400 hover:text-white"
        >
          <Pencil className="h-4 w-4" />
        </button>
      </div>
    )
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center space-x-2">
        <input
          type="text"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          disabled={saving}
          maxLength={20}
          autoComplete="off"
          aria-label="Username"
          className="w-40 rounded border border-[#4a6b7d] bg-transparent px-2 py-1 text-sm font-medium text-white focus:outline-none focus:ring-2 focus:ring-[#c23a3a] disabled:opacity-50"
        />
        <button
          type="button"
          onClick={handleSave}
          disabled={saving}
          aria-label="Save username"
          className="text-green-500 hover:text-green-400 disabled:opacity-50"
        >
          <Check className="h-4 w-4" />
        </button>
        <button
          type="button"
          onClick={cancelEditing}
          disabled={saving}
          aria-label="Cancel editing username"
          className="text-gray-400 hover:text-white disabled:opacity-50"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
      {error && <p className="text-sm text-red-400">{error}</p>}
    </div>
  )
}
