"use client"

import { useCallback, useEffect, useState } from "react"
import { Card } from "@/components/ui/card"
import { format, parseISO } from "date-fns"
import { RefreshCw, Trash2 } from "lucide-react"

interface Pick {
  id: string
  song: string
  pickType: string
  wasPlayed: boolean | null
  pointsEarned: number
}

interface Submission {
  id: string
  totalPoints: number
  isScored: boolean
  username?: string
  picks: Pick[]
}

interface Show {
  id: string
  venue: string
  city: string
  state: string
  showDate: string
  isComplete: boolean
  lockTime: string | null
  lastScoredAt: string | null
}

interface SetlistSong {
  song: string
  set: string
  position: number
}

interface Setlist {
  songs: SetlistSong[]
}

interface ResultsData {
  show: Show
  submission: Submission
  setlist: Setlist | null
}

interface ResultsClientProps {
  showId: string
  isAdmin: boolean
}

export default function ResultsClient({ showId, isAdmin }: ResultsClientProps) {
  const [data, setData] = useState<ResultsData | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date())
  const [deletingSubmission, setDeletingSubmission] = useState(false)

  const handleDeleteSubmission = async () => {
    if (!data?.submission?.id) {
      alert(
        "No submission found for this show. Only the user who made the submission can delete it."
      )
      return
    }

    const confirmed = confirm(
      `Are you sure you want to delete this submission for ${data.show.venue}? This action cannot be undone.`
    )

    if (!confirmed) return

    setDeletingSubmission(true)

    try {
      const response = await fetch(
        `/api/admin/delete-submission/${data.submission.id}`,
        {
          method: "DELETE",
        }
      )

      const result = await response.json()

      if (!response.ok) {
        throw new Error(result.error || "Failed to delete submission")
      }

      // Redirect back to results after deletion
      window.location.href = "/results"
    } catch (err) {
      console.error("Delete error:", err)
      alert(err instanceof Error ? err.message : "Failed to delete submission")
    } finally {
      setDeletingSubmission(false)
    }
  }

  const fetchResults = useCallback(async () => {
    try {
      const response = await fetch(`/api/results/${showId}`)

      if (!response.ok) {
        if (response.status === 404) {
          setError("No picks found for this show")
        } else {
          setError("Failed to load results")
        }
        setLoading(false)
        return
      }

      const json = await response.json()
      setData(json)
      setError(null)
      setLastUpdated(new Date())
    } catch (err) {
      console.error("Error fetching results:", err)
      setError("Failed to load results")
    } finally {
      setLoading(false)
    }
  }, [showId])

  // Initial fetch
  useEffect(() => {
    fetchResults()
  }, [showId, fetchResults])

  // Poll every 60 seconds if show is not complete
  useEffect(() => {
    if (!data?.show.isComplete) {
      const interval = setInterval(() => {
        fetchResults()
      }, 60000) // 60 seconds

      return () => clearInterval(interval)
    }
  }, [data?.show.isComplete, showId, fetchResults])

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto space-y-6">
        <div className="text-center text-slate-400">Loading results...</div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="max-w-4xl mx-auto space-y-6">
        <Card className="p-6">
          <p className="text-red-400">{error}</p>
        </Card>
      </div>
    )
  }

  if (!data) {
    return null
  }

  const { show, submission, setlist } = data
  // Parse as UTC to avoid timezone conversion issues
  // The showDate is stored as UTC midnight (e.g., "2025-07-23T00:00:00.000Z")
  // We need to display it as the actual show date, not convert to local timezone
  const showDateStr = show.showDate.split("T")[0] // Extract YYYY-MM-DD from ISO string
  const showDate = parseISO(showDateStr + "T12:00:00.000Z") // Parse at noon UTC to avoid timezone issues
  const isInProgress =
    !show.isComplete && setlist && setlist.songs && setlist.songs.length > 0
  const isTestShow = show.venue.includes("Test Venue")

  // Group picks by type
  const openerPicks = submission.picks.filter((p) => p.pickType === "OPENER")
  const encorePicks = submission.picks.filter((p) => p.pickType === "ENCORE")
  const regularPicks = submission.picks.filter((p) => p.pickType === "REGULAR")

  // Group setlist by set
  const setlistBySets = setlist?.songs?.reduce(
    (acc, song) => {
      if (!acc[song.set]) {
        acc[song.set] = []
      }
      acc[song.set].push(song)
      return acc
    },
    {} as Record<string, SetlistSong[]>
  )

  const getPickStatus = (pick: Pick) => {
    if (pick.wasPlayed === null) {
      return "text-slate-500"
    }
    return pick.wasPlayed ? "text-green-400 font-semibold" : "text-slate-600"
  }

  const getPickIcon = (pick: Pick) => {
    if (pick.wasPlayed === null) {
      return "○"
    }
    return pick.wasPlayed ? "✓" : "✗"
  }

  // Helper function to check if a song was picked by the user
  const getSongPickInfo = (songName: string, songPosition: number) => {
    // Check if this song was picked by the user
    const userPick = submission.picks.find(
      (pick) => pick.song.toLowerCase().trim() === songName.toLowerCase().trim()
    )

    if (!userPick) {
      return null // Song was not picked
    }

    // Determine pick type and points
    let pickType = ""
    let points = 0
    let isCorrectPosition = false

    if (userPick.pickType === "OPENER" && songPosition === 1) {
      pickType = "Opener"
      points = userPick.pointsEarned || 0
      isCorrectPosition = true
    } else if (userPick.pickType === "ENCORE") {
      pickType = "Encore"
      points = userPick.pointsEarned || 0
      isCorrectPosition = true
    } else if (userPick.pickType === "REGULAR") {
      pickType = "Pick"
      points = userPick.pointsEarned || 0
      isCorrectPosition = true
    } else {
      // Song was picked but not in the right position (e.g., picked as opener but wasn't)
      pickType =
        userPick.pickType === "OPENER"
          ? "Opener (wrong)"
          : userPick.pickType === "ENCORE"
            ? "Encore (wrong)"
            : "Pick"
      points = 0
      isCorrectPosition = false
    }

    return {
      pickType,
      points,
      isCorrectPosition,
      wasPlayed: userPick.wasPlayed,
    }
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-white">Results</h1>
        <p className="text-slate-400">
          {show.venue} • {show.city}
          {show.state && `, ${show.state}`} • {format(showDate, "MMMM d, yyyy")}
          {isTestShow && (
            <span className="ml-2 px-2 py-1 bg-purple-500/20 text-purple-400 rounded text-xs">
              TEST SHOW
            </span>
          )}
        </p>
      </div>

      {/* Status Banner */}
      <Card className="p-4 border-l-4 border-l-blue-500">
        <div className="flex items-center justify-between">
          <div>
            {show.isComplete ? (
              <div className="flex items-center gap-2">
                <span className="text-green-400 text-xl">✓</span>
                <span className="text-white font-semibold">Final Score</span>
              </div>
            ) : isInProgress ? (
              <div className="flex items-center gap-2">
                <span className="text-yellow-400 text-xl">◐</span>
                <span className="text-white font-semibold">
                  Show In Progress
                </span>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <span className="text-slate-400 text-xl">○</span>
                <span className="text-white font-semibold">
                  Waiting for Show
                </span>
              </div>
            )}
            <p className="text-sm text-slate-400 mt-1">
              {isInProgress &&
                `Updates every 60 seconds • Last updated: ${format(lastUpdated, "h:mm:ss a")}`}
              {!isInProgress &&
                !show.isComplete &&
                "Scores will appear here once the show starts"}
            </p>
          </div>
          <div className="text-right">
            <div className="text-3xl font-bold text-white">
              {submission.totalPoints || 0}
            </div>
            <div className="text-sm text-slate-400">points</div>
          </div>
        </div>
      </Card>

      {/* Setlist */}
      {setlist && setlist.songs && setlist.songs.length > 0 && (
        <Card className="p-6">
          <h2 className="text-xl font-bold text-white mb-4">Setlist</h2>
          <div className="space-y-4">
            {Object.entries(setlistBySets || {}).map(([setName, songs]) => (
              <div key={setName}>
                <h3 className="text-sm font-semibold text-slate-400 uppercase mb-2">
                  {setName}
                </h3>
                <div className="space-y-1">
                  {songs.map((song, idx) => {
                    const pickInfo = getSongPickInfo(song.song, song.position)
                    return (
                      <div
                        key={idx}
                        className="flex items-center gap-3 py-1.5 border-b border-slate-700"
                      >
                        <span className="text-slate-500 w-6 text-right text-sm">
                          {song.position}
                        </span>
                        {pickInfo ? (
                          <span
                            className={`text-xl ${pickInfo.isCorrectPosition ? "text-green-400" : "text-yellow-400"}`}
                          >
                            ✓
                          </span>
                        ) : (
                          <span className="text-xl text-slate-600">-</span>
                        )}
                        <span
                          className={
                            pickInfo
                              ? "text-white font-medium"
                              : "text-slate-300"
                          }
                        >
                          {song.song}
                        </span>
                        {pickInfo && (
                          <>
                            <span
                              className={`text-xs px-2 py-0.5 rounded-full ${
                                pickInfo.isCorrectPosition
                                  ? "bg-green-500/20 text-green-400"
                                  : "bg-yellow-500/20 text-yellow-400"
                              }`}
                            >
                              {pickInfo.pickType}
                            </span>
                            {pickInfo.points > 0 && (
                              <span className="ml-auto text-green-400 font-semibold text-sm">
                                +{pickInfo.points}
                              </span>
                            )}
                          </>
                        )}
                      </div>
                    )
                  })}
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Your Picks Summary */}
      <Card className="p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-bold text-white">
            {data?.submission?.username && isAdmin
              ? `${data.submission.username}'s Picks`
              : "Your Picks"}
          </h2>
          {isAdmin && data?.submission && (
            <button
              onClick={handleDeleteSubmission}
              disabled={deletingSubmission}
              className="inline-flex items-center gap-2 px-3 py-2 text-sm text-red-400 hover:text-red-300 transition-colors disabled:opacity-50 disabled:cursor-not-allowed border border-red-500/30 hover:border-red-500/50 rounded-lg"
              title="Delete this submission"
            >
              {deletingSubmission ? (
                <>
                  <RefreshCw className="h-4 w-4 animate-spin" />
                  Deleting...
                </>
              ) : (
                <>
                  <Trash2 className="h-4 w-4" />
                  Delete Submission
                </>
              )}
            </button>
          )}
        </div>

        {/* Opener */}
        <div className="mb-6">
          <h3 className="text-sm font-semibold text-slate-400 uppercase mb-2">
            Opener (3 pts)
          </h3>
          <div className="space-y-2">
            {openerPicks.map((pick) => (
              <div
                key={pick.id}
                className="flex items-center justify-between py-2 border-b border-slate-700"
              >
                <div className="flex items-center gap-3">
                  <span className={`text-xl ${getPickStatus(pick)}`}>
                    {getPickIcon(pick)}
                  </span>
                  <span className={getPickStatus(pick)}>{pick.song}</span>
                </div>
                <span className={`font-semibold ${getPickStatus(pick)}`}>
                  {pick.pointsEarned > 0 ? `+${pick.pointsEarned}` : ""}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Encore */}
        <div className="mb-6">
          <h3 className="text-sm font-semibold text-slate-400 uppercase mb-2">
            Encore (3 pts)
          </h3>
          <div className="space-y-2">
            {encorePicks.map((pick) => (
              <div
                key={pick.id}
                className="flex items-center justify-between py-2 border-b border-slate-700"
              >
                <div className="flex items-center gap-3">
                  <span className={`text-xl ${getPickStatus(pick)}`}>
                    {getPickIcon(pick)}
                  </span>
                  <span className={getPickStatus(pick)}>{pick.song}</span>
                </div>
                <span className={`font-semibold ${getPickStatus(pick)}`}>
                  {pick.pointsEarned > 0 ? `+${pick.pointsEarned}` : ""}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Regular Picks */}
        <div>
          <h3 className="text-sm font-semibold text-slate-400 uppercase mb-2">
            Regular Picks (1 pt each)
          </h3>
          <div className="space-y-2">
            {regularPicks.map((pick) => (
              <div
                key={pick.id}
                className="flex items-center gap-3 py-2 border-b border-slate-700"
              >
                <span className={`text-xl ${getPickStatus(pick)}`}>
                  {getPickIcon(pick)}
                </span>
                <span className={getPickStatus(pick)}>{pick.song}</span>
                {pick.pointsEarned > 0 && (
                  <span
                    className={`ml-auto font-semibold ${getPickStatus(pick)}`}
                  >
                    +{pick.pointsEarned}
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>
      </Card>
    </div>
  )
}
