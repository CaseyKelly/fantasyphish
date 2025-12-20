"use client"

import { useState, useEffect } from "react"
import { Card } from "@/components/ui/card"
import { format } from "date-fns"
import { RefreshCw, Eye, AlertCircle } from "lucide-react"

interface Show {
  id: string
  venue: string
  city: string
  state: string
  showDate: string
  isComplete: boolean
  submissionCount: number
  lockTime: string | null
}

export default function AdminPage() {
  const [shows, setShows] = useState<Show[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [processingShow, setProcessingShow] = useState<string | null>(null)
  const [actionResult, setActionResult] = useState<{
    type: "success" | "error"
    message: string
  } | null>(null)

  const fetchShows = async () => {
    try {
      const response = await fetch("/api/shows")
      if (!response.ok) {
        throw new Error("Failed to fetch shows")
      }
      const data = await response.json()
      setShows(data.shows)
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load shows")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchShows()
  }, [])

  const handleReset = async (showId: string) => {
    if (
      !confirm(
        "Are you sure you want to reset this show? This will clear all scores and setlist data."
      )
    ) {
      return
    }

    setProcessingShow(showId)
    setActionResult(null)

    try {
      const response = await fetch("/api/admin/reset-show", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ showId }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || "Failed to reset show")
      }

      setActionResult({
        type: "success",
        message: `Reset ${data.submissionsReset} submissions`,
      })

      // Refresh shows list
      await fetchShows()
    } catch (err) {
      setActionResult({
        type: "error",
        message: err instanceof Error ? err.message : "Failed to reset show",
      })
    } finally {
      setProcessingShow(null)
    }
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <h1 className="text-3xl font-bold text-white">Admin Panel</h1>
        <p className="text-slate-400">Loading shows...</p>
      </div>
    )
  }

  if (error) {
    return (
      <div className="space-y-6">
        <h1 className="text-3xl font-bold text-white">Admin Panel</h1>
        <Card className="p-6">
          <p className="text-red-400">{error}</p>
        </Card>
      </div>
    )
  }

  const showsWithSubmissions = shows.filter((s) => s.submissionCount > 0)

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-white">Admin Panel</h1>
        <p className="text-slate-400 mt-1">Manage shows and submissions</p>
      </div>

      {actionResult && (
        <Card
          className={`p-4 border-l-4 ${
            actionResult.type === "success"
              ? "border-l-green-500 bg-green-500/10"
              : "border-l-red-500 bg-red-500/10"
          }`}
        >
          <div className="flex items-center gap-2">
            {actionResult.type === "success" ? (
              <span className="text-green-400 text-xl">✓</span>
            ) : (
              <AlertCircle className="h-5 w-5 text-red-400" />
            )}
            <p
              className={
                actionResult.type === "success"
                  ? "text-green-400"
                  : "text-red-400"
              }
            >
              {actionResult.message}
            </p>
          </div>
        </Card>
      )}

      {showsWithSubmissions.length === 0 ? (
        <Card className="p-8 text-center">
          <p className="text-slate-400">
            No shows with submissions found. Users need to submit picks first.
          </p>
        </Card>
      ) : (
        <div className="space-y-4">
          {showsWithSubmissions.map((show) => {
            const showDate = new Date(show.showDate)
            const isProcessing = processingShow === show.id

            return (
              <Card key={show.id} className="p-6">
                <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
                  <div className="flex-1">
                    <h3 className="text-lg font-semibold text-white">
                      {show.venue}
                    </h3>
                    <p className="text-sm text-slate-400 mt-1">
                      {show.city}
                      {show.state && `, ${show.state}`} •{" "}
                      {format(showDate, "MMM d, yyyy")}
                    </p>
                    <div className="flex items-center gap-4 mt-2 text-sm">
                      <span className="text-slate-400">
                        {show.submissionCount} submission
                        {show.submissionCount !== 1 ? "s" : ""}
                      </span>
                      {show.isComplete && (
                        <span className="px-2 py-1 bg-green-500/20 text-green-400 rounded text-xs">
                          Scored
                        </span>
                      )}
                      {!show.isComplete && show.lockTime && (
                        <span className="px-2 py-1 bg-yellow-500/20 text-yellow-400 rounded text-xs">
                          Locked
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <a
                      href={`/results_detail/${show.id}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="px-4 py-2 bg-blue-500/20 hover:bg-blue-500/30 text-blue-400 rounded-lg transition-colors flex items-center gap-2 text-sm"
                    >
                      <Eye className="h-4 w-4" />
                      View
                    </a>

                    <button
                      onClick={() => handleReset(show.id)}
                      disabled={isProcessing}
                      className="px-4 py-2 bg-red-500/20 hover:bg-red-500/30 text-red-400 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 text-sm"
                    >
                      <RefreshCw className="h-4 w-4" />
                      Reset
                    </button>
                  </div>
                </div>
              </Card>
            )
          })}
        </div>
      )}
    </div>
  )
}
