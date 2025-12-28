"use client"

import { useState, useMemo, useEffect } from "react"
import { useRouter } from "next/navigation"
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
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardHeader } from "@/components/ui/card"

interface Song {
  id: string
  name: string
  slug: string
  artist: string
  timesPlayed: number
}

interface Pick {
  songId: string
  songName: string
  pickType: "OPENER" | "ENCORE" | "REGULAR"
}

interface Show {
  id: string
  venue: string
  city: string
  state: string
  showDate: string
}

interface SongPickerProps {
  show: Show
  songs: Song[]
  existingPicks?: Pick[]
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
  }, [mobileModalOpen])

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
    <div className="max-h-64 overflow-y-auto space-y-1">
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
              className={`w-full text-left px-3 py-2 rounded-lg transition-colors ${
                isSelected
                  ? "bg-[#3d5a6c]/50 text-gray-500 cursor-not-allowed"
                  : "hover:bg-[#3d5a6c] text-white"
              }`}
            >
              <div className="flex items-center justify-between">
                <p className="font-medium">{song.name}</p>
                {isSelected && <Check className="h-4 w-4 text-green-500" />}
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
      <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4">
        <div className="bg-[#2d4654] w-full max-w-2xl rounded-lg max-h-[90vh] flex flex-col">
          {/* Modal Header */}
          <div className="flex items-center justify-between p-4 border-b border-[#3d5a6c]">
            <h2 className="text-xl font-semibold text-white">{title}</h2>
            <button
              onClick={() => setMobileModalOpen(null)}
              className="p-2 hover:bg-[#3d5a6c] rounded-lg transition-colors"
            >
              <X className="h-5 w-5 text-gray-400" />
            </button>
          </div>

          {/* Current Selection */}
          {pickType !== "REGULAR" && currentPick && !isLocked && (
            <div className="p-4 border-b border-[#3d5a6c]">
              <button
                onClick={() => handleRemovePick(pickType)}
                className="w-full flex items-center justify-between px-4 py-3 bg-[#3d5a6c] rounded-lg text-white hover:bg-[#4a6b7d]"
              >
                <span>Current: {currentPick.songName}</span>
                <X className="h-4 w-4" />
              </button>
            </div>
          )}

          {pickType === "REGULAR" && picks.length > 0 && !isLocked && (
            <div className="p-4 border-b border-[#3d5a6c]">
              <p className="text-sm text-gray-400 mb-2">
                Selected ({picks.length}/11):
              </p>
              <div className="flex flex-wrap gap-2">
                {picks.map((pick) => (
                  <button
                    key={pick.songId}
                    onClick={() => handleRemovePick("REGULAR", pick.songId)}
                    className="flex items-center space-x-1 px-3 py-1.5 bg-[#3d5a6c] rounded-full text-sm text-white hover:bg-[#4a6b7d]"
                  >
                    <span>{pick.songName}</span>
                    <X className="h-3 w-3" />
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Search */}
          <div className="p-4 border-b border-[#3d5a6c]">
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
          <div className="flex-1 overflow-y-auto p-4">
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
          className="cursor-pointer"
          onClick={() => {
            if (isMobile && !isLocked) {
              setMobileModalOpen(pickType)
            } else {
              setExpandedSection(isExpanded ? null : pickType.toLowerCase())
            }
          }}
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div
                className={`p-2 rounded-lg ${
                  pickType === "REGULAR" ? "bg-[#3d5a6c]" : "bg-[#c23a3a]/20"
                }`}
              >
                {icon}
              </div>
              <div>
                <h3 className="font-semibold text-white">{title}</h3>
                <p className="text-sm text-gray-400">{subtitle}</p>
              </div>
            </div>
            <div className="flex items-center space-x-3">
              {pickType === "REGULAR" ? (
                pickCount === 11 ? (
                  <span className="px-3 py-1 bg-green-500/20 text-green-400 rounded-full text-sm font-medium">
                    Complete
                  </span>
                ) : (
                  <span className="text-gray-500 text-sm">
                    {11 - (pickCount || 0)} more needed
                  </span>
                )
              ) : currentPick ? (
                <span className="px-3 py-1 bg-green-500/20 text-green-400 rounded-full text-sm font-medium max-w-[150px] truncate">
                  {currentPick.songName}
                </span>
              ) : (
                <span className="text-gray-500 text-sm">Not selected</span>
              )}
              {!isMobile &&
                (isExpanded ? (
                  <ChevronUp className="h-5 w-5 text-gray-400" />
                ) : (
                  <ChevronDown className="h-5 w-5 text-gray-400" />
                ))}
            </div>
          </div>
        </CardHeader>
        {!isMobile && isExpanded && (
          <CardContent>
            {pickType !== "REGULAR" && currentPick && !isLocked && (
              <button
                onClick={() => handleRemovePick(pickType)}
                className="mb-4 flex items-center space-x-2 px-3 py-2 bg-[#3d5a6c] rounded-lg text-sm text-white hover:bg-[#4a6b7d]"
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
                    className="flex items-center space-x-1 px-3 py-1.5 bg-[#3d5a6c] rounded-full text-sm text-white hover:bg-[#4a6b7d]"
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
    <div className="space-y-6">
      {/* Mobile Modal */}
      {isMobile && renderMobileModal()}

      {/* Show Header - only show if not in guest mode and not hidden */}
      {!guestMode && !hideHeader && (
        <div className="text-center">
          <h1 className="text-2xl sm:text-3xl font-bold text-white mb-2">
            {isTestMode ? "Create Test Submission" : "Make Your Picks"}
          </h1>
          {isTestMode && (
            <div className="mb-2">
              <span className="inline-flex items-center px-3 py-1 rounded-full text-sm bg-purple-500/20 text-purple-300 border border-purple-500/30">
                Test Mode
              </span>
            </div>
          )}
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

      {/* Locked Banner */}
      {isLocked && (
        <div className="bg-[#c23a3a]/20 border border-[#c23a3a]/30 rounded-lg p-4 flex items-center justify-center space-x-2">
          <Lock className="h-5 w-5 text-[#d64545]" />
          <p className="text-[#d64545]">
            This show has started. Picks are locked.
          </p>
        </div>
      )}

      {/* Search - only show on desktop */}
      {!isMobile && (
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
      )}

      {/* Pick Sections */}
      <div className="space-y-4">
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

      {/* Submit Button */}
      {!isLocked && (
        <div
          className={`bg-[#2d4654]/95 backdrop-blur-sm p-3 sm:p-4 rounded-xl border transition-colors ${
            hasUnsavedChanges && isComplete
              ? "border-yellow-500/50 bg-yellow-500/5"
              : justSaved && isComplete
                ? "border-green-500/50 bg-green-500/5"
                : "border-[#3d5a6c]"
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
