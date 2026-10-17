"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import {
  getMaxPoints,
  getRegularPickCount,
  MAX_SET_COUNT,
  MIN_SET_COUNT,
} from "@/lib/pick-rules"

interface ShowSetCountFormProps {
  showId: string
  setCount: number
  submissionCount: number
  // Submissions with fewer opener picks than the show now has sets
  submissionsNeedingUpdate: number
  isLocked: boolean
}

function plural(n: number, word: string): string {
  return `${n} ${word}${n === 1 ? "" : "s"}`
}

const SET_COUNT_OPTIONS = Array.from(
  { length: MAX_SET_COUNT - MIN_SET_COUNT + 1 },
  (_, i) => MIN_SET_COUNT + i
)

export function ShowSetCountForm({
  showId,
  setCount,
  submissionCount,
  submissionsNeedingUpdate,
  isLocked,
}: ShowSetCountFormProps) {
  const router = useRouter()
  const [selected, setSelected] = useState(setCount)
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Once anyone has picked, the set count can only go up: raising just
  // prompts existing pickers to add the new set openers, while lowering
  // would strand opener picks for a set that no longer exists.
  const hasPicks = submissionCount > 0
  const isRaising = selected > setCount
  const selectId = `set-count-${showId}`

  const handleSave = async () => {
    setIsSaving(true)
    setError(null)
    try {
      const response = await fetch("/api/admin/set-show-set-count", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ showId, setCount: selected }),
      })
      const data = (await response.json()) as { error?: string }
      if (!response.ok) {
        throw new Error(data.error || "Failed to set set count")
      }
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to set set count")
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <div
      data-testid={`show-set-count-${showId}`}
      className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between"
    >
      <div>
        <p className="text-sm text-gray-400">
          {setCount === 1 ? "1 set" : `${setCount} sets`} &mdash; {setCount}{" "}
          {setCount === 1 ? "opener" : "openers"}, 1 encore,{" "}
          {getRegularPickCount(setCount)} regular ({getMaxPoints(setCount)} pts
          max)
        </p>
        {isLocked ? (
          <p className="text-sm text-gray-500">
            Picks have locked &mdash; the set count can no longer change
          </p>
        ) : (
          hasPicks && (
            <p className="text-sm text-gray-500">
              {plural(submissionCount, "submission")} in &mdash; the set count
              can only go up
            </p>
          )
        )}
        {submissionsNeedingUpdate > 0 && (
          <p className="text-sm text-yellow-400">
            {plural(submissionsNeedingUpdate, "submission")}{" "}
            {submissionsNeedingUpdate === 1 ? "needs" : "need"} updating for the
            new set {submissionsNeedingUpdate === 1 ? "opener" : "openers"}
          </p>
        )}
        {hasPicks && isRaising && (
          <p className="text-sm text-yellow-400">
            Saving asks everyone who already picked to add the new set{" "}
            {selected - setCount === 1 ? "opener" : "openers"}; their saved
            picks keep counting until they do
          </p>
        )}
        {error && <p className="mt-1 text-sm text-[#d64545]">{error}</p>}
      </div>

      {!isLocked && (
        <div className="flex flex-wrap items-end gap-2">
          <div className="w-32">
            <label
              htmlFor={selectId}
              className="block text-sm font-medium text-gray-300 mb-1.5"
            >
              Sets
            </label>
            <select
              id={selectId}
              value={selected}
              onChange={(e) => setSelected(Number(e.target.value))}
              disabled={isSaving}
              className="w-32 px-4 py-2.5 bg-[#233d4d] border-2 border-[#4a6b7d] rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-[#c23a3a] focus:border-transparent disabled:opacity-50"
            >
              {SET_COUNT_OPTIONS.map((n) => (
                <option key={n} value={n} disabled={hasPicks && n < setCount}>
                  {n}
                </option>
              ))}
            </select>
          </div>
          <Button
            size="md"
            onClick={handleSave}
            isLoading={isSaving}
            disabled={selected === setCount}
          >
            Save sets
          </Button>
        </div>
      )}
    </div>
  )
}
