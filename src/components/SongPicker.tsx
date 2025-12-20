"use client"

import { useState, useMemo } from "react"
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
  onGuestSubmit,
  onSubmitSuccess,
}: SongPickerProps) {
  const router = useRouter()
  const [searchQuery, setSearchQuery] = useState("")
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [expandedSection, setExpandedSection] = useState<string | null>(
    "opener"
  )

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

  const handleSelectSong = (
    song: Song,
    pickType: "OPENER" | "ENCORE" | "REGULAR"
  ) => {
    if (isLocked) return

    const pick: Pick = {
      songId: song.id,
      songName: song.name,
      pickType,
    }

    if (pickType === "OPENER") {
      setOpenerPick(pick)
      setExpandedSection("encore")
    } else if (pickType === "ENCORE") {
      setEncorePick(pick)
      setExpandedSection("regular")
    } else {
      if (regularPicks.length < 11) {
        setRegularPicks([...regularPicks, pick])
        if (regularPicks.length === 10) {
          setExpandedSection(null)
        }
      }
    }
  }

  const handleRemovePick = (
    pickType: "OPENER" | "ENCORE" | "REGULAR",
    songId?: string
  ) => {
    if (isLocked) return

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
                <div>
                  <p className="font-medium">{song.name}</p>
                  {song.artist !== "Phish" && (
                    <p className="text-sm text-gray-400">{song.artist}</p>
                  )}
                </div>
                {isSelected && <Check className="h-4 w-4 text-green-500" />}
              </div>
            </button>
          )
        })
      )}
    </div>
  )

  return (
    <div className="space-y-6">
      {/* Show Header - only show if not in guest mode */}
      {!guestMode && (
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

      {/* Search */}
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

      {/* Pick Sections */}
      <div className="space-y-4">
        {/* Opener Section */}
        <Card>
          <CardHeader
            className="cursor-pointer"
            onClick={() =>
              setExpandedSection(expandedSection === "opener" ? null : "opener")
            }
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <div className="p-2 bg-[#c23a3a]/20 rounded-lg">
                  <Star className="h-5 w-5 text-[#c23a3a]" />
                </div>
                <div>
                  <h3 className="font-semibold text-white">Opener Pick</h3>
                  <p className="text-sm text-gray-400">3 points if correct</p>
                </div>
              </div>
              <div className="flex items-center space-x-3">
                {openerPick ? (
                  <span className="px-3 py-1 bg-green-500/20 text-green-400 rounded-full text-sm font-medium">
                    {openerPick.songName}
                  </span>
                ) : (
                  <span className="text-gray-500 text-sm">Not selected</span>
                )}
                {expandedSection === "opener" ? (
                  <ChevronUp className="h-5 w-5 text-gray-400" />
                ) : (
                  <ChevronDown className="h-5 w-5 text-gray-400" />
                )}
              </div>
            </div>
          </CardHeader>
          {expandedSection === "opener" && (
            <CardContent>
              {openerPick && !isLocked && (
                <button
                  onClick={() => handleRemovePick("OPENER")}
                  className="mb-4 flex items-center space-x-2 px-3 py-2 bg-[#3d5a6c] rounded-lg text-sm text-white hover:bg-[#4a6b7d]"
                >
                  <X className="h-4 w-4" />
                  <span>Remove: {openerPick.songName}</span>
                </button>
              )}
              {renderSongList("OPENER")}
            </CardContent>
          )}
        </Card>

        {/* Encore Section */}
        <Card>
          <CardHeader
            className="cursor-pointer"
            onClick={() =>
              setExpandedSection(expandedSection === "encore" ? null : "encore")
            }
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <div className="p-2 bg-[#c23a3a]/20 rounded-lg">
                  <Star className="h-5 w-5 text-[#c23a3a]" />
                </div>
                <div>
                  <h3 className="font-semibold text-white">Encore Pick</h3>
                  <p className="text-sm text-gray-400">3 points if correct</p>
                </div>
              </div>
              <div className="flex items-center space-x-3">
                {encorePick ? (
                  <span className="px-3 py-1 bg-green-500/20 text-green-400 rounded-full text-sm font-medium">
                    {encorePick.songName}
                  </span>
                ) : (
                  <span className="text-gray-500 text-sm">Not selected</span>
                )}
                {expandedSection === "encore" ? (
                  <ChevronUp className="h-5 w-5 text-gray-400" />
                ) : (
                  <ChevronDown className="h-5 w-5 text-gray-400" />
                )}
              </div>
            </div>
          </CardHeader>
          {expandedSection === "encore" && (
            <CardContent>
              {encorePick && !isLocked && (
                <button
                  onClick={() => handleRemovePick("ENCORE")}
                  className="mb-4 flex items-center space-x-2 px-3 py-2 bg-[#3d5a6c] rounded-lg text-sm text-white hover:bg-[#4a6b7d]"
                >
                  <X className="h-4 w-4" />
                  <span>Remove: {encorePick.songName}</span>
                </button>
              )}
              {renderSongList("ENCORE")}
            </CardContent>
          )}
        </Card>

        {/* Regular Picks Section */}
        <Card>
          <CardHeader
            className="cursor-pointer"
            onClick={() =>
              setExpandedSection(
                expandedSection === "regular" ? null : "regular"
              )
            }
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <div className="p-2 bg-[#3d5a6c] rounded-lg">
                  <Music className="h-5 w-5 text-white" />
                </div>
                <div>
                  <h3 className="font-semibold text-white">Regular Picks</h3>
                  <p className="text-sm text-gray-400">
                    1 point each ({regularPicks.length}/11 selected)
                  </p>
                </div>
              </div>
              <div className="flex items-center space-x-3">
                {regularPicks.length === 11 ? (
                  <span className="px-3 py-1 bg-green-500/20 text-green-400 rounded-full text-sm font-medium">
                    Complete
                  </span>
                ) : (
                  <span className="text-gray-500 text-sm">
                    {11 - regularPicks.length} more needed
                  </span>
                )}
                {expandedSection === "regular" ? (
                  <ChevronUp className="h-5 w-5 text-gray-400" />
                ) : (
                  <ChevronDown className="h-5 w-5 text-gray-400" />
                )}
              </div>
            </div>
          </CardHeader>
          {expandedSection === "regular" && (
            <CardContent>
              {/* Selected regular picks */}
              {regularPicks.length > 0 && !isLocked && (
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
              {regularPicks.length < 11 && renderSongList("REGULAR")}
              {regularPicks.length === 11 && (
                <p className="text-center text-green-400 py-4">
                  All 11 regular picks selected!
                </p>
              )}
            </CardContent>
          )}
        </Card>
      </div>

      {/* Submit Button */}
      {!isLocked && (
        <div className="max-sm:sticky bottom-4 bg-[#2d4654]/95 backdrop-blur-sm p-3 sm:p-4 rounded-xl border border-[#3d5a6c]">
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0 flex-1">
              <p className="font-medium text-white text-sm sm:text-base">
                {isComplete
                  ? existingPicks
                    ? "Picks saved"
                    : "Ready to submit!"
                  : "Complete your picks"}
              </p>
              <p className="text-xs sm:text-sm text-gray-400">
                {13 - selectedSongIds.size} picks remaining
              </p>
            </div>
            <Button
              onClick={handleSubmit}
              disabled={!isComplete || isSubmitting}
              isLoading={isSubmitting}
              size="lg"
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
