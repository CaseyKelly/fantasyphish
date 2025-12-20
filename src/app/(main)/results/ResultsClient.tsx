"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { format } from "date-fns"
import {
  Trophy,
  Target,
  Percent,
  Calendar,
  MapPin,
  Check,
  X,
  Clock,
  Eye,
  Plus,
  RefreshCw,
  AlertCircle,
  Trash2,
} from "lucide-react"
import { Card, CardContent, CardHeader } from "@/components/ui/card"

// Helper to format show dates consistently without timezone issues
function formatShowDate(showDate: Date | string, formatStr: string): string {
  // Handle Date input and ensure it's valid
  if (showDate instanceof Date) {
    if (isNaN(showDate.getTime())) {
      return "Invalid date"
    }
  }

  const dateStr =
    typeof showDate === "string" ? showDate : showDate.toISOString()

  // Basic validation for string input (expecting an ISO-like value)
  if (typeof showDate === "string") {
    const isoDatePrefixPattern = /^\d{4}-\d{2}-\d{2}/
    if (!isoDatePrefixPattern.test(showDate)) {
      return "Invalid date"
    }
  }

  const datePart = dateStr.split("T")[0] // Extract YYYY-MM-DD
  // Parse at noon UTC to avoid timezone conversion issues
  const date = new Date(datePart + "T12:00:00.000Z")

  // Ensure the constructed Date is valid before formatting
  if (isNaN(date.getTime())) {
    return "Invalid date"
  }

  return format(date, formatStr)
}

interface Pick {
  id: string
  pickType: string
  song: {
    id: string
    name: string
    slug: string
    artist: string
    timesPlayed: number
    createdAt: Date
    updatedAt: Date
  }
  wasPlayed: boolean | null
  pointsEarned: number | null
}

interface Show {
  id: string
  venue: string
  city: string | null
  state: string | null
  country: string | null
  showDate: Date
  isComplete: boolean
  tour: {
    name: string
  } | null
}

interface Submission {
  id: string
  totalPoints: number | null
  isScored: boolean
  show: Show
  picks: Pick[]
}

interface Stats {
  totalSubmissions: number
  scoredSubmissions: number
  totalPoints: number
  avgPoints: number
  correctPicks: number
  totalPicks: number
  accuracy: number
}

interface ResultsClientProps {
  submissions: Submission[]
  stats: Stats
  isAdmin: boolean
}

export default function ResultsClient({
  submissions,
  stats,
  isAdmin,
}: ResultsClientProps) {
  const router = useRouter()
  const [adminLoading, setAdminLoading] = useState<string | null>(null)
  const [deletingSubmission, setDeletingSubmission] = useState<string | null>(
    null
  )

  const handleDeleteSubmission = async (
    submissionId: string,
    showVenue: string
  ) => {
    if (
      !confirm(
        `Are you sure you want to delete this submission for ${showVenue}?`
      )
    ) {
      return
    }

    setDeletingSubmission(submissionId)

    try {
      const response = await fetch(
        `/api/admin/delete-submission/${submissionId}`,
        {
          method: "DELETE",
        }
      )

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || "Failed to delete submission")
      }

      // Refresh the page to update the list
      window.location.reload()
    } catch (err) {
      console.error("Delete error:", err)
      // Just refresh anyway - the user will see if the deletion worked
      window.location.reload()
    } finally {
      setDeletingSubmission(null)
    }
  }

  const handleCreateTestSubmission = async () => {
    setAdminLoading("creating")

    try {
      const response = await fetch("/api/admin/test-submission", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || "Failed to create test submission")
      }

      // Refresh the results page to show the new test submission
      router.refresh()
    } catch (err) {
      console.error("Test submission error:", err)
      alert(
        err instanceof Error ? err.message : "Failed to create test submission"
      )
    } finally {
      setAdminLoading(null)
    }
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-white">Results</h1>
        <p className="text-slate-400 mt-1">
          View your past submissions and scores
        </p>
      </div>

      {/* Admin Testing Controls */}
      {isAdmin && (
        <Card>
          <CardContent className="p-6">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div>
                <h3 className="text-lg font-semibold text-white flex items-center gap-2">
                  <AlertCircle className="h-5 w-5 text-orange-500" />
                  Admin Testing Controls
                </h3>
                <p className="text-sm text-slate-400 mt-1">
                  Create test submissions from historical shows to test the
                  scoring system
                </p>
              </div>
              <div className="flex items-center gap-3">
                <button
                  onClick={handleCreateTestSubmission}
                  disabled={!!adminLoading}
                  className="px-4 py-2 bg-purple-500/20 hover:bg-purple-500/30 text-purple-400 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                >
                  {adminLoading === "creating" ? (
                    <>
                      <RefreshCw className="h-4 w-4 animate-spin" />
                      Creating...
                    </>
                  ) : (
                    <>
                      <Plus className="h-4 w-4" />
                      Create Random Test Submission
                    </>
                  )}
                </button>
                <button
                  onClick={() => (window.location.href = "/pick/test")}
                  disabled={!!adminLoading}
                  className="px-4 py-2 bg-blue-500/20 hover:bg-blue-500/30 text-blue-400 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                >
                  <Plus className="h-4 w-4" />
                  Create Test Submission
                </button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center space-x-3">
              <div className="p-2 bg-orange-500/20 rounded-lg">
                <Trophy className="h-5 w-5 text-orange-500" />
              </div>
              <div>
                <p className="text-2xl font-bold text-white">
                  {stats.totalPoints}
                </p>
                <p className="text-sm text-slate-400">Total Points</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center space-x-3">
              <div className="p-2 bg-blue-500/20 rounded-lg">
                <Target className="h-5 w-5 text-blue-500" />
              </div>
              <div>
                <p className="text-2xl font-bold text-white">
                  {stats.avgPoints}
                </p>
                <p className="text-sm text-slate-400">Avg Points</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center space-x-3">
              <div className="p-2 bg-green-500/20 rounded-lg">
                <Percent className="h-5 w-5 text-green-500" />
              </div>
              <div>
                <p className="text-2xl font-bold text-white">
                  {stats.accuracy}%
                </p>
                <p className="text-sm text-slate-400">Accuracy</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center space-x-3">
              <div className="p-2 bg-purple-500/20 rounded-lg">
                <Calendar className="h-5 w-5 text-purple-500" />
              </div>
              <div>
                <p className="text-2xl font-bold text-white">
                  {stats.scoredSubmissions}
                </p>
                <p className="text-sm text-slate-400">Shows Scored</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Submissions List */}
      {submissions.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Calendar className="h-12 w-12 text-slate-500 mx-auto mb-4" />
            <p className="text-slate-400">
              You haven&apos;t made any picks yet. Head to the dashboard to get
              started!
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-6">
          {submissions.map((submission) => (
            <Card key={submission.id}>
              <CardHeader>
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                  <div>
                    <h3 className="font-semibold text-white text-lg">
                      {submission.show.venue}
                      {submission.show.venue.includes("Test Venue") && (
                        <span className="ml-2 inline-flex items-center px-2 py-1 rounded-full text-xs bg-purple-500/20 text-purple-300 border border-purple-500/30">
                          Test
                        </span>
                      )}
                    </h3>
                    <div className="flex items-center space-x-4 text-sm text-slate-400 mt-1">
                      <span className="flex items-center">
                        <MapPin className="h-4 w-4 mr-1" />
                        {submission.show.city},{" "}
                        {submission.show.state || submission.show.country}
                      </span>
                      <span className="flex items-center">
                        <Calendar className="h-4 w-4 mr-1" />
                        {formatShowDate(
                          submission.show.showDate,
                          "MMM d, yyyy"
                        )}
                      </span>
                    </div>
                  </div>
                  <div className="text-left sm:text-right">
                    {submission.isScored ? (
                      <div>
                        <p className="text-3xl font-bold text-orange-500">
                          {submission.totalPoints}
                        </p>
                        <p className="text-sm text-slate-400">points</p>
                      </div>
                    ) : (
                      <span className="flex items-center text-slate-400">
                        <Clock className="h-4 w-4 mr-1" />
                        Awaiting results
                      </span>
                    )}
                    <div className="flex items-center gap-2 mt-3">
                      <Link
                        href={`/results_detail/${submission.show.id}`}
                        className="inline-flex items-center gap-2 px-4 py-2 bg-blue-500/20 hover:bg-blue-500/30 text-blue-400 hover:text-blue-300 rounded-lg border border-blue-500/30 hover:border-blue-500/50 transition-all font-medium"
                      >
                        <Eye className="h-4 w-4" />
                        View Details
                      </Link>
                      {isAdmin && (
                        <button
                          onClick={() =>
                            handleDeleteSubmission(
                              submission.id,
                              submission.show.venue
                            )
                          }
                          disabled={deletingSubmission === submission.id}
                          className="inline-flex items-center gap-2 px-4 py-2 bg-red-500/20 hover:bg-red-500/30 text-red-400 hover:text-red-300 rounded-lg border border-red-500/30 hover:border-red-500/50 transition-all disabled:opacity-50 disabled:cursor-not-allowed font-medium"
                          title="Delete submission"
                        >
                          {deletingSubmission === submission.id ? (
                            <RefreshCw className="h-4 w-4 animate-spin" />
                          ) : (
                            <Trash2 className="h-4 w-4" />
                          )}
                          Delete
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {/* Special Picks */}
                  <div className="grid sm:grid-cols-2 gap-4">
                    {submission.picks
                      .filter((p: Pick) => p.pickType !== "REGULAR")
                      .map((pick: Pick) => (
                        <div
                          key={pick.id}
                          className={`flex items-center justify-between p-3 rounded-lg ${
                            submission.isScored
                              ? pick.wasPlayed
                                ? "bg-green-500/10 border border-green-500/30"
                                : "bg-red-500/10 border border-red-500/30"
                              : "bg-slate-700/50"
                          }`}
                        >
                          <div>
                            <p className="text-xs text-slate-400 uppercase mb-1">
                              {pick.pickType === "OPENER" ? "Opener" : "Encore"}
                            </p>
                            <p className="font-medium text-white">
                              {pick.song.name}
                            </p>
                          </div>
                          {submission.isScored && (
                            <div className="flex items-center space-x-2">
                              <span
                                className={`font-bold ${
                                  pick.wasPlayed
                                    ? "text-green-400"
                                    : "text-red-400"
                                }`}
                              >
                                {pick.wasPlayed ? "+3" : "0"}
                              </span>
                              {pick.wasPlayed ? (
                                <Check className="h-5 w-5 text-green-400" />
                              ) : (
                                <X className="h-5 w-5 text-red-400" />
                              )}
                            </div>
                          )}
                        </div>
                      ))}
                  </div>

                  {/* Regular Picks */}
                  <div>
                    <p className="text-sm text-slate-400 mb-2">Regular Picks</p>
                    <div className="flex flex-wrap gap-2">
                      {submission.picks
                        .filter((p: Pick) => p.pickType === "REGULAR")
                        .map((pick: Pick) => (
                          <span
                            key={pick.id}
                            className={`px-3 py-1.5 rounded-full text-sm flex items-center space-x-1 ${
                              submission.isScored
                                ? pick.wasPlayed
                                  ? "bg-green-500/20 text-green-400"
                                  : "bg-slate-700 text-slate-400"
                                : "bg-slate-700 text-white"
                            }`}
                          >
                            <span>{pick.song.name}</span>
                            {submission.isScored && pick.wasPlayed && (
                              <Check className="h-3 w-3" />
                            )}
                          </span>
                        ))}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
