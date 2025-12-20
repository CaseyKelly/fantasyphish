"use client"

import { useEffect, useState } from "react"
import { Sparkles } from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"
import { DonutLogo } from "@/components/DonutLogo"
import { SongPicker } from "@/components/SongPicker"
import { LoadingDonut } from "@/components/LoadingDonut"
import { formatInTimeZone } from "date-fns-tz"
import { getTimezoneAbbr, parseUTCDate } from "@/lib/date-utils"

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

interface Tour {
  id: string
  name: string
  startDate: string
  endDate: string | null
}

interface Show {
  id: string
  venue: string
  city: string
  state: string
  country: string
  showDate: string
  isComplete: boolean
  lockTime: string | null
  timezone: string | null
  tour: Tour | null
  userSubmission?: {
    id: string
    picks: Array<{
      id: string
      songId: string
      pickType: "OPENER" | "ENCORE" | "REGULAR"
      song: Song
    }>
  } | null
}

export default function PicksPage() {
  const [nextShow, setNextShow] = useState<Show | null>(null)
  const [songs, setSongs] = useState<Song[]>([])
  const [loading, setLoading] = useState(true)
  const [isLocked, setIsLocked] = useState(false)

  const fetchData = async () => {
    try {
      const [showRes, songsRes] = await Promise.all([
        fetch("/api/shows?next=true"),
        fetch("/api/songs"),
      ])

      const showData = await showRes.json()
      const songsData = await songsRes.json()

      if (showData.nextShow) {
        setNextShow(showData.nextShow)

        // Check if show is locked
        if (showData.nextShow.lockTime) {
          const lockTime = new Date(showData.nextShow.lockTime)
          setIsLocked(new Date() >= lockTime)
        }
      }

      setSongs(songsData.songs || [])
    } catch (error) {
      console.error("Error fetching data:", error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchData()
  }, [])

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <LoadingDonut size="xl" text="Loading your picks..." />
      </div>
    )
  }

  if (!nextShow) {
    return (
      <div className="space-y-8">
        {/* Header */}
        <div>
          <h1 className="text-3xl font-bold text-white">Make Your Picks</h1>
          <p className="text-slate-400 mt-1">
            Select your songs for the next show
          </p>
        </div>

        {/* Empty State - No Upcoming Shows */}
        <div className="min-h-[60vh] flex items-center justify-center px-4">
          <Card className="max-w-2xl w-full bg-gradient-to-br from-[#1e3340] to-[#2d4654] border-[#3d5a6c]/50">
            <CardContent className="py-16 px-8 text-center">
              {/* Animated Donut Logo */}
              <div className="mb-8 flex justify-center">
                <div className="relative">
                  <DonutLogo size="xl" />
                  <div className="absolute -top-2 -right-2">
                    <Sparkles className="h-6 w-6 text-[#c23a3a] animate-pulse" />
                  </div>
                </div>
              </div>

              {/* Main Message */}
              <h2 className="text-3xl sm:text-4xl font-bold text-white mb-6">
                Picks Opening Soon!
              </h2>

              <p className="text-base text-gray-400 max-w-xl mx-auto mb-8 leading-relaxed">
                Check back before the first show to make your picks! Choose your
                opener, encore, and 11 regular songs to compete for glory.
              </p>

              {/* Status Box */}
              <div className="inline-flex items-center space-x-3 px-6 py-4 bg-[#3d5a6c]/30 rounded-xl border border-[#3d5a6c]/50">
                <Sparkles className="h-5 w-5 text-[#c23a3a] animate-pulse" />
                <span className="text-gray-300 font-medium">
                  Picks open before first show
                </span>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    )
  }

  // Transform existing picks for SongPicker
  const existingPicks: Pick[] | undefined = nextShow.userSubmission?.picks.map(
    (pick) => ({
      songId: pick.songId,
      songName: pick.song.name,
      pickType: pick.pickType,
    })
  )

  return (
    <div className="space-y-6 pb-8">
      {/* Header */}
      <div className="text-center mb-4">
        <h1 className="text-3xl font-bold text-white mb-2">Make Your Picks</h1>
        {nextShow.tour && (
          <p className="text-slate-400 mb-2">{nextShow.tour.name}</p>
        )}
        <p className="text-gray-400 mb-2">
          {nextShow.venue} • {nextShow.city}
          {nextShow.state && `, ${nextShow.state}`} •{" "}
          {parseUTCDate(nextShow.showDate, "MMMM d, yyyy")}
        </p>
        {!isLocked && nextShow.lockTime && nextShow.timezone && (
          <p className="text-sm text-gray-500">
            Picks lock at{" "}
            {formatInTimeZone(
              new Date(nextShow.lockTime),
              nextShow.timezone,
              "h a"
            )}{" "}
            {getTimezoneAbbr(nextShow.timezone)} on{" "}
            {parseUTCDate(nextShow.showDate, "MMM d")}
          </p>
        )}
      </div>

      <SongPicker
        show={{
          id: nextShow.id,
          venue: nextShow.venue,
          city: nextShow.city || "",
          state: nextShow.state || "",
          showDate: nextShow.showDate,
        }}
        songs={songs}
        existingPicks={existingPicks}
        isLocked={isLocked}
        guestMode={true}
        onSubmitSuccess={fetchData}
      />
    </div>
  )
}
