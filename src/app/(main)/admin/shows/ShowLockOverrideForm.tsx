"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { formatInTimeZone, fromZonedTime } from "date-fns-tz"
import { getTimezoneAbbr, parseUTCDate } from "@/lib/date-utils"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"

interface ShowSummary {
  id: string
  showDate: string
  venue: string
  city: string | null
  state: string | null
  timezone: string
  lockTime: string | null
  lockTimeOverride: string | null
}

interface SetLockOverrideResponse {
  show: { lockTime: string | null }
}

export function ShowLockOverrideForm({ show }: { show: ShowSummary }) {
  const router = useRouter()
  const currentLockTime = show.lockTime ? new Date(show.lockTime) : null
  const [timeInput, setTimeInput] = useState(
    currentLockTime
      ? formatInTimeZone(currentLockTime, show.timezone, "HH:mm")
      : "19:00"
  )
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const hasOverride = !!show.lockTimeOverride
  const tzAbbr = getTimezoneAbbr(show.timezone)

  const handleSave = async () => {
    setIsSaving(true)
    setError(null)
    try {
      const datePart = show.showDate.split("T")[0]
      const overrideDate = fromZonedTime(
        `${datePart} ${timeInput}:00`,
        show.timezone
      )

      const response = await fetch("/api/admin/set-show-lock-override", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          showId: show.id,
          lockTime: overrideDate.toISOString(),
        }),
      })

      const data = (await response.json()) as SetLockOverrideResponse & {
        error?: string
      }
      if (!response.ok) {
        throw new Error(data.error || "Failed to set lock time")
      }

      if (data.show.lockTime) {
        setTimeInput(
          formatInTimeZone(new Date(data.show.lockTime), show.timezone, "HH:mm")
        )
      }
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to set lock time")
    } finally {
      setIsSaving(false)
    }
  }

  const handleClear = async () => {
    setIsSaving(true)
    setError(null)
    try {
      const response = await fetch("/api/admin/set-show-lock-override", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ showId: show.id, lockTime: null }),
      })

      const data = (await response.json()) as SetLockOverrideResponse & {
        error?: string
      }
      if (!response.ok) {
        throw new Error(data.error || "Failed to clear lock time override")
      }

      if (data.show.lockTime) {
        setTimeInput(
          formatInTimeZone(new Date(data.show.lockTime), show.timezone, "HH:mm")
        )
      }
      router.refresh()
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Failed to clear lock time override"
      )
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <div
      data-testid={`show-lock-override-${show.id}`}
      className="flex flex-col gap-3 border-b-2 border-[#4a6b7d]/30 pb-4 last:border-b-0 last:pb-0 sm:flex-row sm:items-end sm:justify-between"
    >
      <div>
        <p className="font-semibold text-white">
          {show.venue}
          {show.city && (
            <span className="text-gray-400">
              {" "}
              &middot; {show.city}
              {show.state && `, ${show.state}`}
            </span>
          )}
        </p>
        <p className="text-sm text-gray-400">
          {parseUTCDate(show.showDate, "MMMM d, yyyy")} &mdash;{" "}
          {currentLockTime ? (
            <>
              Locks at{" "}
              {formatInTimeZone(currentLockTime, show.timezone, "h:mm a")}{" "}
              {tzAbbr}
              {hasOverride && (
                <span className="text-[#d64545]"> (manual override)</span>
              )}
            </>
          ) : (
            "No lock time set"
          )}
        </p>
        {error && <p className="mt-1 text-sm text-[#d64545]">{error}</p>}
      </div>

      <div className="flex items-end gap-2">
        <Input
          type="time"
          id={`lock-time-${show.id}`}
          label={`Lock time (${tzAbbr})`}
          value={timeInput}
          onChange={(e) => setTimeInput(e.target.value)}
          className="w-32"
          disabled={isSaving}
        />
        <Button size="sm" onClick={handleSave} isLoading={isSaving}>
          Save
        </Button>
        {hasOverride && (
          <Button
            size="sm"
            variant="outline"
            onClick={handleClear}
            disabled={isSaving}
          >
            Clear
          </Button>
        )}
      </div>
    </div>
  )
}
