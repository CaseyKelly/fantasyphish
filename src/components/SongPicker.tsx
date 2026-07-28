"use client"

import { useState, useMemo, useEffect } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { format } from "date-fns"
import { toast } from "sonner"
import {
  Search,
  X,
  Music,
  Star,
  ChevronDown,
  ChevronUp,
  Lock,
  Check,
  MapPin,
  Calendar,
  AlertCircle,
  CheckCircle,
  Trophy,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { LiveBadge } from "@/components/LiveBadge"

interface Song {
  id: string
  name: string
  slug: string
  artist: string
  timesPlayed: number
  gap: number | null
  lastPlayed: Date | null
}

interface Pick {
  songId: string
  songName: string
  pickType: "OPENER" | "ENCORE" | "REGULAR"
  wasPlayed?: boolean | null
  pointsEarned?: number | null
}

interface Show {
  id: string
  venue: string
  city: string
  state: string
  showDate: string
  isComplete?: boolean
}

interface SongPickerProps {
  show: Show
  songs: Song[]
  existingPicks?: Pick[]
  totalPoints?: number | null
  isLocked: boolean
  isTestMode?: boolean
  guestMode?: boolean
  hideHeader?: boolean
  onGuestSubmit?: (picks: Pick[]) => void
  onSubmitSuccess?: () => void
}

export function SongPicker({
  show,
  songs,
  existingPicks,
  totalPoints,
  isLocked,
  isTestMode = false,
  guestMode = false,
  hideHeader = false,
  onGuestSubmit,
  onSubmitSuccess,
}: SongPickerProps) {
  const router = useRouter()
  const [searchQuery, setSearchQuery] = useState("")
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [expandedSection, setExpandedSection] = useState<string | null>(
    "opener"
  )
  const [isMobile, setIsMobile] = useState(false)
  const [mobileModalOpen, setMobileModalOpen] = useState<
    "OPENER" | "ENCORE" | "REGULAR" | null
  >(null)
  const [justSaved, setJustSaved] = useState(false)

  // Live scoring state for the locked panel - seeded from server props,
  // refreshed periodically once the show has started
  const [livePicks, setLivePicks] = useState<Pick[] | undefined>(existingPicks)
  const [liveIsComplete, setLiveIsComplete] = useState(show.isComplete ?? false)
  const [liveTotalPoints, setLiveTotalPoints] = useState<
    number | null | undefined
  >(totalPoints)

  // Refresh live scoring for the locked panel. Data only changes as often as
  // the /api/score cron runs (every 10 minutes), so there's no benefit to
  // polling more often - and this endpoint reads from Postgres, not
  // phish.net, so it carries no phish.net rate-limit risk either way.
  useEffect(() => {
    if (
      !isLocked ||
      guestMode ||
      !existingPicks ||
      existingPicks.length === 0 ||
      liveIsComplete
    ) {
      return
    }

    const interval = setInterval(
      async () => {
        try {
          const res = await fetch(`/api/results/${show.id}`)
          if (!res.ok) return
          const data = await res.json()

          const scoredByKey = new Map<
            string,
            { wasPlayed: boolean | null; pointsEarned: number | null }
          >()
          for (const p of data.submission.picks as Array<{
            song: string
            pickType: string
            wasPlayed: boolean | null
            pointsEarned: number | null
          }>) {
            scoredByKey.set(`${p.pickType}:${p.song.toLowerCase().trim()}`, {
              wasPlayed: p.wasPlayed,
              pointsEarned: p.pointsEarned,
            })
          }

          setLivePicks(
            existingPicks.map((pick) => {
              const scored = scoredByKey.get(
                `${pick.pickType}:${pick.songName.toLowerCase().trim()}`
              )
              return scored ? { ...pick, ...scored } : pick
            })
          )
          setLiveTotalPoints(data.submission.totalPoints)
          setLiveIsComplete(Boolean(data.show.isComplete))
        } catch (err) {
          console.error("Error refreshing live scoring:", err)
        }
      },
      10 * 60 * 1000
    )

    return () => clearInterval(interval)
  }, [isLocked, guestMode, existingPicks, liveIsComplete, show.id])

  // Detect mobile viewport
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 640)
    }
    checkMobile()
    window.addEventListener("resize", checkMobile)
    return () => window.removeEventListener("resize", checkMobile)
  }, [])

  // Initialize picks from existing submission
  const [openerPick, setOpenerPick] = useState<Pick | null>(
    existingPicks?.find((p) => p.pickType === "OPENER") || null
  )
  const [encorePick, setEncorePick] = useState<Pick | null>(
    existingPicks?.find((p) => p.pickType === "ENCORE") || null
  )
  const [regularPicks, setRegularPicks] = useState<Pick[]>(
    existingPicks?.filter((p) => p.pickType === "REGULAR") || []
  )

  // Auto-clear justSaved state after a delay to avoid showing both icons
  useEffect(() => {
    if (justSaved) {
      const timer = setTimeout(() => setJustSaved(false), 3000)
      return () => clearTimeout(timer)
    }
  }, [justSaved])

  // Prevent background scroll when mobile modal is open and clear search when closed
  useEffect(() => {
    if (mobileModalOpen) {
      document.body.style.overflow = "hidden"
    } else {
      document.body.style.overflow = ""
      setSearchQuery("")
    }

    return () => {
      document.body.style.overflow = ""
    }
  }, [mobileModalOpen, setSearchQuery])

  // Filter songs based on search
  const filteredSongs = useMemo(() => {
    if (!searchQuery) return songs
    const query = searchQuery.toLowerCase()
    return songs.filter(
      (song) =>
        song.name.toLowerCase().includes(query) ||
        song.artist.toLowerCase().includes(query)
    )
  }, [songs, searchQuery])

  // Get all selected song IDs
  const selectedSongIds = useMemo(() => {
    const ids = new Set<string>()
    if (openerPick) ids.add(openerPick.songId)
    if (encorePick) ids.add(encorePick.songId)
    regularPicks.forEach((p) => ids.add(p.songId))
    return ids
  }, [openerPick, encorePick, regularPicks])

  // Track if current picks differ from existing picks (unsaved changes)
  const hasUnsavedChanges = useMemo(() => {
    if (!existingPicks || existingPicks.length === 0) return false

    // Check if all current picks match existing picks
    const existingOpener = existingPicks.find((p) => p.pickType === "OPENER")
    const existingEncore = existingPicks.find((p) => p.pickType === "ENCORE")
    const existingRegular = existingPicks.filter(
      (p) => p.pickType === "REGULAR"
    )

    if (openerPick?.songId !== existingOpener?.songId) return true
    if (encorePick?.songId !== existingEncore?.songId) return true
    if (regularPicks.length !== existingRegular.length) return true

    const regularSongIds = new Set(regularPicks.map((p) => p.songId))
    const existingRegularIds = new Set(existingRegular.map((p) => p.songId))

    for (const id of regularSongIds) {
      if (!existingRegularIds.has(id)) return true
    }

    return false
  }, [openerPick, encorePick, regularPicks, existingPicks])

  const handleSelectSong = (
    song: Song,
    pickType: "OPENER" | "ENCORE" | "REGULAR"
  ) => {
    if (isLocked) return

    // Clear "just saved" state when making changes
    if (justSaved) setJustSaved(false)

    const pick: Pick = {
      songId: song.id,
      songName: song.name,
      pickType,
    }

    if (pickType === "OPENER") {
      setOpenerPick(pick)
      if (isMobile) {
        setMobileModalOpen(null)
      } else {
        setExpandedSection("encore")
      }
    } else if (pickType === "ENCORE") {
      setEncorePick(pick)
      if (isMobile) {
        setMobileModalOpen(null)
      } else {
        setExpandedSection("regular")
      }
    } else {
      if (regularPicks.length < 11) {
        setRegularPicks([...regularPicks, pick])
        if (regularPicks.length === 10) {
          if (isMobile) {
            setMobileModalOpen(null)
          } else {
            setExpandedSection(null)
          }
        }
      }
    }
  }

  const handleRemovePick = (
    pickType: "OPENER" | "ENCORE" | "REGULAR",
    songId?: string
  ) => {
    if (isLocked) return

    // Clear "just saved" state when making changes
    if (justSaved) setJustSaved(false)

    if (pickType === "OPENER") {
      setOpenerPick(null)
    } else if (pickType === "ENCORE") {
      setEncorePick(null)
    } else if (songId) {
      setRegularPicks(regularPicks.filter((p) => p.songId !== songId))
    }
  }

  const handleSubmit = async () => {
    if (!openerPick || !encorePick || regularPicks.length !== 11) {
      toast.error("Please complete all picks before submitting")
      return
    }

    // If in guest mode, call the onGuestSubmit callback
    if (guestMode && onGuestSubmit) {
      const allPicks = [openerPick, encorePick, ...regularPicks]
      onGuestSubmit(allPicks)
      return
    }

    setIsSubmitting(true)

    try {
      const picks = [
        { songId: openerPick.songId, pickType: "OPENER" },
        { songId: encorePick.songId, pickType: "ENCORE" },
        ...regularPicks.map((p) => ({ songId: p.songId, pickType: "REGULAR" })),
      ]

      // Use different endpoint for test mode
      const endpoint = isTestMode
        ? "/api/admin/create-test-submission"
        : "/api/picks"

      const response = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ showId: show.id, picks }),
      })

      const data = await response.json()

      if (!response.ok) {
        toast.error(data.error || "Failed to submit picks")
      } else {
        // Set justSaved state to show success feedback
        setJustSaved(true)

        toast.success(
          isTestMode
            ? "Test submission created successfully!"
            : data.message || "Picks submitted successfully!"
        )

        // If onSubmitSuccess callback is provided, call it instead of redirecting
        if (onSubmitSuccess) {
          onSubmitSuccess()
        } else {
          router.push(isTestMode ? "/results" : "/picks")
          router.refresh()
        }
      }
    } catch {
      toast.error("An unexpected error occurred")
    } finally {
      setIsSubmitting(false)
    }
  }

  const isComplete = openerPick && encorePick && regularPicks.length === 11

  const renderSongList = (pickType: "OPENER" | "ENCORE" | "REGULAR") => (
    <div className="max-h-64 overflow-y-auto space-y-1 p-1">
      {filteredSongs.length === 0 ? (
        <p className="text-center text-gray-400 py-4">No songs found</p>
      ) : (
        filteredSongs.map((song) => {
          const isSelected = selectedSongIds.has(song.id)
          const isDisabled = isSelected || isLocked

          return (
            <button
              key={song.id}
              onClick={() => !isDisabled && handleSelectSong(song, pickType)}
              disabled={isDisabled}
              className={`w-full text-left px-3 py-2 rounded-lg transition-all ${
                isSelected
                  ? "bg-[#1e3340]/60 text-gray-500 cursor-not-allowed"
                  : "hover:bg-[#4a6b7d]/50 focus:bg-[#4a6b7d]/50 focus:outline-none focus:ring-2 focus:ring-[#c23a3a]/50 text-white"
              }`}
            >
              <div className="flex items-center justify-between gap-2">
                <p className="font-medium flex-1 min-w-0 truncate">
                  {song.name}
                </p>
                <div className="flex items-center gap-2 flex-shrink-0">
                  {song.gap !== null &&
                    song.gap !== undefined &&
                    (() => {
                      const showsAgo = song.gap + 1
                      return (
                        <span className="text-xs text-gray-400 whitespace-nowrap">
                          played {showsAgo} {showsAgo === 1 ? "show" : "shows"}{" "}
                          ago
                        </span>
                      )
                    })()}
                  {isSelected && <Check className="h-4 w-4 text-green-500" />}
                </div>
              </div>
            </button>
          )
        })
      )}
    </div>
  )

  const renderMobileModal = () => {
    if (!mobileModalOpen) return null

    const pickType = mobileModalOpen
    let title = ""
    let currentPick = null
    let picks: Pick[] = []

    if (pickType === "OPENER") {
      title = "Select Opener"
      currentPick = openerPick
    } else if (pickType === "ENCORE") {
      title = "Select Encore"
      currentPick = encorePick
    } else {
      title = "Select Regular Picks"
      picks = regularPicks
    }

    return (
      <div
        className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4"
        style={{ minHeight: "100dvh" }}
      >
        <div className="bg-[#233d4d] w-full max-w-2xl rounded-lg max-h-[90dvh] flex flex-col border-2 border-[#4a6b7d]/60">
          {/* Modal Header */}
          <div className="flex items-center justify-between p-4 border-b-2 border-[#4a6b7d]/60">
            <h2 className="text-xl font-semibold text-white">{title}</h2>
            <button
              onClick={() => setMobileModalOpen(null)}
              className="p-2 hover:bg-[#4a6b7d]/50 rounded-lg transition-colors"
            >
              <X className="h-5 w-5 text-gray-400" />
            </button>
          </div>

          {/* Current Selection */}
          {pickType !== "REGULAR" && currentPick && !isLocked && (
            <div className="p-4 border-b-2 border-[#4a6b7d]/60">
              <button
                onClick={() => handleRemovePick(pickType)}
                className="w-full flex items-center justify-between px-4 py-3 bg-[#4a6b7d] rounded-lg text-white hover:bg-[#5a7b8d] transition-colors"
              >
                <span>Current: {currentPick.songName}</span>
                <X className="h-4 w-4" />
              </button>
            </div>
          )}

          {pickType === "REGULAR" && picks.length > 0 && !isLocked && (
            <div className="p-4 border-b-2 border-[#4a6b7d]/60">
              <p className="text-sm text-gray-400 mb-2">
                Selected ({picks.length}/11):
              </p>
              <div className="flex flex-wrap gap-2">
                {picks.map((pick) => (
                  <button
                    key={pick.songId}
                    onClick={() => handleRemovePick("REGULAR", pick.songId)}
                    className="flex items-center space-x-1 px-3 py-1.5 bg-[#4a6b7d] rounded-full text-sm text-white hover:bg-[#5a7b8d] transition-colors"
                  >
                    <span>{pick.songName}</span>
                    <X className="h-3 w-3" />
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Search */}
          <div className="p-4 border-b-2 border-[#4a6b7d]/60">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
              <Input
                type="text"
                placeholder="Search songs..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery("")}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white"
                >
                  <X className="h-5 w-5" />
                </button>
              )}
            </div>
          </div>

          {/* Song List */}
          <div className="flex-1 overflow-y-auto px-4 pt-4 pb-4">
            {pickType === "REGULAR" && picks.length === 11 ? (
              <p className="text-center text-green-400 py-4">
                All 11 regular picks selected!
              </p>
            ) : (
              renderSongList(pickType)
            )}
          </div>
        </div>
      </div>
    )
  }

  const renderLockedPanel = () => {
    const picks = livePicks ?? existingPicks
    const opener = picks?.find((p) => p.pickType === "OPENER")
    const encore = picks?.find((p) => p.pickType === "ENCORE")
    const regulars = picks?.filter((p) => p.pickType === "REGULAR") ?? []
    const hasScoringStarted =
      picks?.some((p) => p.wasPlayed !== null && p.wasPlayed !== undefined) ??
      false

    const specialPickClasses = (pick?: Pick) => {
      if (!pick || pick.wasPlayed === null || pick.wasPlayed === undefined) {
        return "bg-[#3d5a6c]/30 border border-[#3d5a6c]/50"
      }
      return pick.wasPlayed
        ? "bg-green-500/10 border border-green-500/30"
        : "bg-red-500/10 border border-red-500/30"
    }

    const regularPickClasses = (pick: Pick) => {
      if (pick.wasPlayed === null || pick.wasPlayed === undefined) {
        return "bg-[#4a6b7d]/40 text-gray-200"
      }
      return pick.wasPlayed
        ? "bg-green-500/20 text-green-400"
        : "bg-slate-700 text-slate-400"
    }

    const renderSpecialPick = (label: string, pick: Pick) => (
      <div
        className={`flex items-center gap-2 px-3 py-2 rounded-lg ${specialPickClasses(pick)}`}
      >
        <Star className="h-4 w-4 text-[#c23a3a] flex-shrink-0" />
        <span className="text-xs text-gray-400 flex-shrink-0">{label}</span>
        <span className="text-sm text-white truncate flex-1 text-left">
          {pick.songName}
        </span>
        {pick.wasPlayed !== null && pick.wasPlayed !== undefined && (
          <span
            className={`text-xs font-semibold flex-shrink-0 ${
              pick.wasPlayed ? "text-green-400" : "text-red-400"
            }`}
          >
            {pick.wasPlayed ? "+3" : "0"}
          </span>
        )}
      </div>
    )

    return (
      <Card className="max-w-md mx-4 sm:mx-0 text-center shadow-2xl">
        <CardContent>
          <div className="mb-6 flex justify-center">
            <div className="relative">
              <div className="absolute inset-0 bg-[#c23a3a]/30 blur-3xl rounded-full animate-pulse" />
              <div className="relative bg-gradient-to-br from-[#c23a3a] to-[#d64545] p-6 rounded-full">
                <Lock className="h-16 w-16 text-white" />
              </div>
            </div>
          </div>
          <h2 className="text-2xl sm:text-3xl font-bold text-white mb-4">
            Your Picks Are Locked In
          </h2>
          <p className="text-gray-400 mb-6">
            {liveIsComplete
              ? "The show is over — here's how you did!"
              : "The show has started and picks can no longer be changed. Scores update live as songs are played."}
          </p>

          {picks && picks.length > 0 && (
            <>
              <div className="text-left mb-6 space-y-2">
                {opener && renderSpecialPick("Opener", opener)}
                {encore && renderSpecialPick("Encore", encore)}
                {regulars.length > 0 && (
                  <div className="flex flex-wrap gap-2 pt-1">
                    {regulars.map((pick) => (
                      <span
                        key={pick.songId}
                        className={`px-3 py-1 rounded-full text-xs flex items-center gap-1 ${regularPickClasses(pick)}`}
                      >
                        <span>{pick.songName}</span>
                        {pick.wasPlayed && <Check className="h-3 w-3" />}
                      </span>
                    ))}
                  </div>
                )}
              </div>

              {hasScoringStarted ? (
                <div className="inline-flex items-center space-x-2 px-6 py-3 bg-[#3d5a6c]/50 rounded-xl border border-[#3d5a6c]/70 mb-6">
                  <span className="text-gray-300 font-medium">
                    {liveIsComplete ? "Final score:" : "Score so far:"}
                  </span>
                  <span className="text-white font-bold text-lg">
                    {liveTotalPoints ?? 0} pts
                  </span>
                </div>
              ) : (
                <div className="inline-flex items-center space-x-3 px-6 py-3 bg-[#3d5a6c]/50 rounded-xl border border-[#3d5a6c]/70 mb-6">
                  <CheckCircle className="h-5 w-5 text-green-400" />
                  <span className="text-gray-300 font-medium">
                    Your picks are saved
                  </span>
                </div>
              )}
            </>
          )}

          <div>
            <Link
              href="/leaderboard"
              className="inline-flex items-center gap-2 px-4 py-2 bg-[#c23a3a] hover:bg-[#d64545] text-white font-semibold rounded-lg shadow-lg shadow-[#c23a3a]/20 transition-colors"
            >
              <Trophy className="h-4 w-4" />
              View Leaderboard
            </Link>
          </div>
        </CardContent>
      </Card>
    )
  }

  const renderPickCard = (
    pickType: "OPENER" | "ENCORE" | "REGULAR",
    title: string,
    subtitle: string,
    icon: React.ReactNode,
    currentPick: Pick | null,
    pickCount?: number
  ) => {
    const isExpanded = expandedSection === pickType.toLowerCase()

    return (
      <Card>
        <CardHeader
          className="cursor-pointer overflow-hidden"
          onClick={() => {
            if (isMobile && !isLocked) {
              setMobileModalOpen(pickType)
            } else {
              setExpandedSection(isExpanded ? null : pickType.toLowerCase())
            }
          }}
        >
          <div className="flex items-center justify-between gap-3 overflow-hidden">
            <div className="flex items-center gap-2 sm:gap-3 min-w-0 flex-1 overflow-hidden">
              <div
                className={`p-2 rounded-lg flex-shrink-0 ${
                  pickType === "REGULAR"
                    ? "bg-[#4a6b7d]"
                    : "bg-[#c23a3a]/30 border border-[#c23a3a]/30"
                }`}
              >
                {icon}
              </div>
              <div className="min-w-0 overflow-hidden">
                <h3 className="font-semibold text-white text-sm sm:text-base truncate">
                  {title}
                </h3>
                <p className="text-xs sm:text-sm text-gray-400 truncate">
                  {subtitle}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2 sm:gap-3 flex-shrink-0">
              {pickType === "REGULAR" ? (
                pickCount === 11 ? (
                  <span className="px-3 py-1 bg-green-500/20 text-green-400 rounded-full text-sm font-medium whitespace-nowrap">
                    Complete
                  </span>
                ) : (
                  <span className="text-gray-500 text-sm whitespace-nowrap">
                    {11 - (pickCount || 0)} more needed
                  </span>
                )
              ) : currentPick ? (
                <span className="px-3 py-1 bg-green-500/20 text-green-400 rounded-full text-sm font-medium max-w-[150px] truncate">
                  {currentPick.songName}
                </span>
              ) : (
                <span className="text-gray-500 text-sm whitespace-nowrap">
                  Not selected
                </span>
              )}
              {!isMobile && isExpanded && (
                <ChevronUp className="h-5 w-5 text-gray-400" />
              )}
              {!isMobile && !isExpanded && (
                <ChevronDown className="h-5 w-5 text-gray-400" />
              )}
            </div>
          </div>
        </CardHeader>
        {!isMobile && isExpanded && (
          <CardContent>
            {pickType !== "REGULAR" && currentPick && !isLocked && (
              <button
                onClick={() => handleRemovePick(pickType)}
                className="mb-4 flex items-center space-x-2 px-3 py-2 bg-[#4a6b7d] rounded-lg text-sm text-white hover:bg-[#5a7b8d] transition-colors"
              >
                <X className="h-4 w-4" />
                <span>Remove: {currentPick.songName}</span>
              </button>
            )}
            {pickType === "REGULAR" && (pickCount || 0) > 0 && !isLocked && (
              <div className="mb-4 flex flex-wrap gap-2">
                {regularPicks.map((pick) => (
                  <button
                    key={pick.songId}
                    onClick={() => handleRemovePick("REGULAR", pick.songId)}
                    className="flex items-center space-x-1 px-3 py-1.5 bg-[#4a6b7d] rounded-full text-sm text-white hover:bg-[#5a7b8d] transition-colors"
                  >
                    <span>{pick.songName}</span>
                    <X className="h-3 w-3" />
                  </button>
                ))}
              </div>
            )}
            {pickType === "REGULAR" && pickCount === 11 ? (
              <p className="text-center text-green-400 py-4">
                All 11 regular picks selected!
              </p>
            ) : (
              renderSongList(pickType)
            )}
          </CardContent>
        )}
      </Card>
    )
  }

  return (
    <div className="space-y-6 relative">
      {/* Mobile Modal */}
      {isMobile && renderMobileModal()}

      {/* Show Header - only show if not in guest mode and not hidden */}
      {!guestMode && !hideHeader && (
        <div className="text-center">
          <h1 className="text-2xl sm:text-3xl font-bold text-white mb-2">
            {isTestMode
              ? "Create Test Submission"
              : isLocked
                ? "Show In Progress"
                : "Make Your Picks"}
          </h1>
          {isTestMode && (
            <div className="mb-2">
              <span className="inline-flex items-center px-3 py-1 rounded-full text-sm bg-purple-500/20 text-purple-300 border border-purple-500/30">
                Test Mode
              </span>
            </div>
          )}
          {isLocked && <LiveBadge />}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-2 sm:gap-4 text-gray-400">
            <span className="flex items-center">
              <Music className="h-4 w-4 mr-1" />
              {show.venue}
            </span>
            <span className="flex items-center">
              <MapPin className="h-4 w-4 mr-1" />
              {show.city}, {show.state}
            </span>
            <span className="flex items-center">
              <Calendar className="h-4 w-4 mr-1" />
              {format(
                new Date(show.showDate.split("T")[0] + "T12:00:00.000Z"),
                "MMMM d, yyyy"
              )}
            </span>
          </div>
        </div>
      )}

      {/* Picker Content Wrapper with Overlay */}
      <div className="relative">
        {/* Mobile: Replace picker with locked message when locked */}
        {isLocked && isMobile ? (
          <div className="flex items-center justify-center py-8">
            {renderLockedPanel()}
          </div>
        ) : (
          <>
            {/* Search - only show on desktop */}
            {!isMobile && (
              // z-10 ensures focus ring isn't clipped by card below
              <div className="relative z-10 mb-6">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-500" />
                <Input
                  type="text"
                  placeholder="Search songs..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                />
                {searchQuery && (
                  <button
                    onClick={() => setSearchQuery("")}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white transition-colors"
                  >
                    <X className="h-5 w-5" />
                  </button>
                )}
              </div>
            )}

            {/* Pick Sections */}
            <div className={`space-y-4 ${isLocked ? "opacity-30" : ""}`}>
              {renderPickCard(
                "OPENER",
                "Opener Pick",
                "3 points if correct",
                <Star className="h-5 w-5 text-[#c23a3a]" />,
                openerPick
              )}
              {renderPickCard(
                "ENCORE",
                "Encore Pick",
                "3 points if correct",
                <Star className="h-5 w-5 text-[#c23a3a]" />,
                encorePick
              )}
              {renderPickCard(
                "REGULAR",
                "Regular Picks",
                `1 point each (${regularPicks.length}/11 selected)`,
                <Music className="h-5 w-5 text-white" />,
                null,
                regularPicks.length
              )}
            </div>

            {/* Desktop: Overlay on top of picker content */}
            {isLocked && !isMobile && (
              <div className="absolute inset-0 z-40 flex items-center justify-center">
                {renderLockedPanel()}
              </div>
            )}
          </>
        )}
      </div>

      {/* Submit Button */}
      {!isLocked && (
        <div
          className={`bg-[#233d4d]/95 backdrop-blur-sm p-3 sm:p-4 rounded-xl border-2 transition-colors ${
            hasUnsavedChanges && isComplete
              ? "border-yellow-500/50 bg-yellow-500/5"
              : justSaved && isComplete
                ? "border-green-500/50 bg-green-500/5"
                : "border-[#4a6b7d]/60"
          }`}
        >
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0 flex-1 flex items-center gap-2">
              {isComplete && justSaved && !hasUnsavedChanges && (
                <CheckCircle className="h-5 w-5 text-green-500 flex-shrink-0" />
              )}
              {isComplete && hasUnsavedChanges && (
                <AlertCircle className="h-5 w-5 text-yellow-500 flex-shrink-0" />
              )}
              <div className="min-w-0">
                <p className="font-medium text-white text-sm sm:text-base">
                  {isComplete
                    ? hasUnsavedChanges
                      ? "Unsaved changes"
                      : justSaved
                        ? "Picks saved!"
                        : existingPicks
                          ? "Picks saved"
                          : "Ready to submit!"
                    : "Complete your picks"}
                </p>
                <p className="text-xs sm:text-sm text-gray-400">
                  {isComplete
                    ? hasUnsavedChanges
                      ? "Click update to save your changes"
                      : justSaved
                        ? "Your picks have been saved successfully"
                        : "All picks completed"
                    : `${13 - selectedSongIds.size} picks remaining`}
                </p>
              </div>
            </div>
            <Button
              onClick={handleSubmit}
              disabled={!isComplete || isSubmitting}
              isLoading={isSubmitting}
              size="lg"
              variant="success"
              className="flex-shrink-0"
            >
              <span className="hidden sm:inline">
                {existingPicks ? "Update Picks" : "Submit Picks"}
              </span>
              <span className="sm:hidden">
                {existingPicks ? "Update" : "Submit"}
              </span>
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
