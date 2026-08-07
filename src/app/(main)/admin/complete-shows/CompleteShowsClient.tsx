"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { format, parseISO } from "date-fns"
import { CheckCircle2 } from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"
import { LoadingDonut } from "@/components/LoadingDonut"
import { GRACE_PERIOD_MS } from "@/lib/scoring-constants"

interface ShowRow {
  id: string
  venue: string
  city: string | null
  state: string | null
  showDate: string
  hasSetlist: boolean
  encoreStartedAt: string | null
  submissionCount: number
}

interface CompleteShowsClientProps {
  initialShows: ShowRow[]
}

function useNow(intervalMs: number) {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), intervalMs)
    return () => clearInterval(interval)
  }, [intervalMs])
  return now
}

function getStatus(show: ShowRow, now: number) {
  if (!show.hasSetlist) {
    return { label: "Not started", tone: "text-slate-400" }
  }
  if (!show.encoreStartedAt) {
    return { label: "In progress", tone: "text-yellow-400" }
  }

  const elapsedMs = now - new Date(show.encoreStartedAt).getTime()
  const remainingMs = GRACE_PERIOD_MS - elapsedMs
  if (remainingMs <= 0) {
    return { label: "Finalizing…", tone: "text-green-400" }
  }
  const remainingMinutes = Math.floor(remainingMs / 60000)
  const remainingSeconds = Math.floor((remainingMs % 60000) / 1000)
  return {
    label: `Encore detected — ${remainingMinutes}m ${remainingSeconds}s left`,
    tone: "text-cyan-400",
  }
}

export default function CompleteShowsClient({
  initialShows,
}: CompleteShowsClientProps) {
  const router = useRouter()
  const now = useNow(1000)
  const [removedIds, setRemovedIds] = useState<Set<string>>(() => new Set())
  const [completingId, setCompletingId] = useState<string | null>(null)
  const shows = initialShows.filter((s) => !removedIds.has(s.id))

  const handleMarkComplete = async (show: ShowRow) => {
    const confirmed = confirm(
      `Mark ${show.venue} complete now? This finalizes scores immediately instead of waiting for the grace period.`
    )
    if (!confirmed) return

    setCompletingId(show.id)

    try {
      const response = await fetch("/api/admin/complete-show", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ showId: show.id }),
      })

      const result = await response.json()

      if (!response.ok) {
        throw new Error(result.error || "Failed to complete show")
      }

      toast.success(`${show.venue} marked complete`)
      setRemovedIds((prev) => new Set(prev).add(show.id))
      router.refresh()
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Failed to complete show"
      )
    } finally {
      setCompletingId(null)
    }
  }

  if (shows.length === 0) {
    return (
      <Card className="p-6">
        <p className="text-slate-400">
          No shows are currently in progress or awaiting the grace period.
        </p>
      </Card>
    )
  }

  return (
    <div className="space-y-3">
      {shows.map((show) => {
        const status = getStatus(show, now)
        const showDate = parseISO(
          show.showDate.split("T")[0] + "T12:00:00.000Z"
        )

        return (
          <Card key={show.id} className="border-2 border-[#4a6b7d]/60">
            <CardContent className="flex items-center justify-between gap-4 flex-wrap">
              <div>
                <div className="text-white font-semibold">
                  {show.venue}
                  {show.city && ` • ${show.city}`}
                  {show.state && `, ${show.state}`}
                </div>
                <div className="text-sm text-slate-400">
                  {format(showDate, "MMMM d, yyyy")} • {show.submissionCount}{" "}
                  submission{show.submissionCount === 1 ? "" : "s"}
                </div>
                <div className={`text-sm mt-1 font-medium ${status.tone}`}>
                  {status.label}
                </div>
              </div>

              <button
                onClick={() => handleMarkComplete(show)}
                disabled={completingId === show.id}
                className="inline-flex items-center gap-2 px-4 py-2 bg-blue-500/20 hover:bg-blue-500/30 text-blue-400 hover:text-blue-300 rounded-lg border-2 border-blue-500/30 hover:border-blue-500/50 transition-all disabled:opacity-50 disabled:cursor-not-allowed font-medium"
              >
                {completingId === show.id ? (
                  <>
                    <LoadingDonut size="xs" color="currentColor" />
                    Completing...
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="h-4 w-4" />
                    Mark Complete
                  </>
                )}
              </button>
            </CardContent>
          </Card>
        )
      })}
    </div>
  )
}
