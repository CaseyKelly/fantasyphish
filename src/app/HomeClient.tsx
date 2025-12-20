"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { format } from "date-fns"
import { formatInTimeZone } from "date-fns-tz"
import { Target, ArrowRight } from "lucide-react"
import { Button } from "@/components/ui/button"
import { DonutLogo } from "@/components/DonutLogo"
import { SongPicker } from "@/components/SongPicker"
import { LoadingDonut } from "@/components/LoadingDonut"
import { GuestRegistrationModal } from "@/components/GuestRegistrationModal"
import { getTimezoneAbbr, parseUTCDate } from "@/lib/date-utils"

interface Song {
  id: string
  name: string
  slug: string
  artist: string
  timesPlayed: number
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
}

export function HomeClient() {
  const [nextShow, setNextShow] = useState<Show | null>(null)
  const [songs, setSongs] = useState<Song[]>([])
  const [loading, setLoading] = useState(true)
  const [guestPicks, setGuestPicks] = useState<Array<{
    songId: string
    songName: string
    pickType: "OPENER" | "ENCORE" | "REGULAR"
  }> | null>(null)

  useEffect(() => {
    async function fetchData() {
      try {
        const [showRes, songsRes] = await Promise.all([
          fetch("/api/shows?next=true"),
          fetch("/api/songs"),
        ])

        const showData = await showRes.json()
        const songsData = await songsRes.json()

        setNextShow(showData.nextShow || null)
        setSongs(songsData.songs || [])
      } catch (error) {
        console.error("Error fetching data:", error)
      } finally {
        setLoading(false)
      }
    }

    fetchData()
  }, [])

  // Helper to format lock time with both venue and user local times
  const formatLockTime = (
    lockTime: string,
    timezone: string | null,
    showDate: string
  ) => {
    const lockDate = new Date(lockTime)

    // Parse showDate as UTC to avoid timezone conversion issues
    const formattedDate = parseUTCDate(showDate, "MMM d")

    if (timezone) {
      // Show venue time (7 PM MT)
      const venueTimeStr = formatInTimeZone(lockDate, timezone, "h a")
      const venueAbbr = getTimezoneAbbr(timezone)

      // Get user's timezone
      const userTz = Intl.DateTimeFormat().resolvedOptions().timeZone
      const userAbbr = getTimezoneAbbr(userTz)

      // Only show local time if different from venue time
      if (userTz !== timezone) {
        const userTimeStr = formatInTimeZone(lockDate, userTz, "h a")
        return `${venueTimeStr} ${venueAbbr} (${userTimeStr} ${userAbbr}) on ${formattedDate}`
      }

      return `${venueTimeStr} ${venueAbbr} on ${formattedDate}`
    }

    return format(lockDate, "h:mm a 'on' MMM d, yyyy")
  }

  return (
    <div className="min-h-screen bg-[#2d4654] relative">
      {/* Repeating donut pattern background */}
      <div className="fixed inset-0 opacity-10 pointer-events-none">
        <svg width="100%" height="100%">
          <defs>
            <pattern
              id="donut-pattern"
              x="0"
              y="0"
              width="120"
              height="120"
              patternUnits="userSpaceOnUse"
            >
              <circle
                cx="30"
                cy="30"
                r="22"
                stroke="#c23a3a"
                strokeWidth="12"
                fill="none"
              />
              <circle
                cx="150"
                cy="30"
                r="22"
                stroke="#c23a3a"
                strokeWidth="12"
                fill="none"
              />
              <circle
                cx="90"
                cy="90"
                r="22"
                stroke="#c23a3a"
                strokeWidth="12"
                fill="none"
              />
              <circle
                cx="-30"
                cy="90"
                r="22"
                stroke="#c23a3a"
                strokeWidth="12"
                fill="none"
              />
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#donut-pattern)" />
        </svg>
      </div>

      {/* Hero Section */}
      <header className="relative overflow-hidden">
        <nav className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <DonutLogo size="lg" />
              <span className="text-xl font-bold text-white">FantasyPhish</span>
            </div>
            <div className="flex items-center space-x-4">
              <Link
                href="/login"
                className="text-gray-300 hover:text-white transition-colors"
              >
                Log In
              </Link>
              <Link href="/register">
                <Button>Sign Up</Button>
              </Link>
            </div>
          </div>
        </nav>

        <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 sm:py-20 pb-8 sm:pb-12">
          <div className="text-center">
            <h1 className="text-4xl sm:text-6xl lg:text-7xl font-bold text-white mb-6">
              You Knew{" "}
              <span className="text-[#c23a3a]">
                They&apos;d Bust Out Fluffhead
              </span>
            </h1>
            <p className="text-lg sm:text-xl text-gray-300 max-w-2xl mx-auto">
              Now prove it. Pick 13 songs before showtime, rack up points when
              Trey plays your calls, and show the lot who really knows
              what&apos;s coming.
            </p>
          </div>
        </div>
      </header>

      {/* Next Show Picker Section */}
      <section className="py-6 relative z-10">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          {/* Solid background container */}
          <div className="bg-[#1e3340] rounded-2xl shadow-2xl border border-[#3d5a6c]/50 p-6 sm:p-8">
            {loading ? (
              // Loading Skeleton
              <>
                {/* Header Skeleton */}
                <div className="text-center mb-6">
                  <div className="h-10 w-64 bg-[#2d4654] rounded-lg mx-auto mb-2 animate-pulse" />
                  <div className="h-6 w-48 bg-[#2d4654] rounded-lg mx-auto mb-2 animate-pulse" />
                  <div className="h-5 w-96 bg-[#2d4654] rounded-lg mx-auto mb-2 animate-pulse" />
                  <div className="h-4 w-72 bg-[#2d4654] rounded-lg mx-auto animate-pulse" />
                </div>

                {/* Search Bar Skeleton */}
                <div className="mb-6">
                  <div className="h-12 w-full bg-[#2d4654] rounded-lg animate-pulse" />
                </div>

                {/* Pick Sections Skeleton */}
                <div className="space-y-4">
                  {[1, 2, 3].map((i) => (
                    <div
                      key={i}
                      className="bg-[#2d4654] rounded-lg border border-[#3d5a6c]/50 overflow-hidden"
                    >
                      {/* Section Header */}
                      <div className="p-4 border-b border-[#3d5a6c]/50">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center space-x-3">
                            <div className="w-8 h-8 bg-[#3d5a6c] rounded animate-pulse" />
                            <div className="h-6 w-32 bg-[#3d5a6c] rounded animate-pulse" />
                          </div>
                          <div className="w-6 h-6 bg-[#3d5a6c] rounded animate-pulse" />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Submit Button Skeleton */}
                <div className="mt-6">
                  <div className="h-12 w-full bg-[#2d4654] rounded-lg animate-pulse" />
                </div>
              </>
            ) : (
              nextShow &&
              songs.length > 0 && (
                <>
                  {/* Header inside container */}
                  <div className="text-center mb-6">
                    <h2 className="text-3xl sm:text-4xl font-bold text-white mb-2">
                      Make Your Picks
                    </h2>
                    {nextShow.tour && (
                      <p className="text-gray-400 text-lg mb-2">
                        {nextShow.tour.name}
                      </p>
                    )}
                    <p className="text-gray-400 mb-2">
                      {nextShow.venue} • {nextShow.city}
                      {nextShow.state && `, ${nextShow.state}`} •{" "}
                      {parseUTCDate(nextShow.showDate, "MMMM d, yyyy")}
                    </p>
                    {nextShow.lockTime && (
                      <p className="text-sm text-gray-500">
                        Picks lock at{" "}
                        {formatLockTime(
                          nextShow.lockTime,
                          nextShow.timezone,
                          nextShow.showDate
                        )}
                      </p>
                    )}
                  </div>

                  {/* Song Picker */}
                  <SongPicker
                    show={{
                      id: nextShow.id,
                      venue: nextShow.venue,
                      city: nextShow.city || "",
                      state: nextShow.state || "",
                      showDate: nextShow.showDate,
                    }}
                    songs={songs}
                    isLocked={false}
                    guestMode={true}
                    onGuestSubmit={(picks) => setGuestPicks(picks)}
                  />
                </>
              )
            )}
          </div>
        </div>
      </section>

      {/* Guest Registration Modal */}
      {guestPicks && nextShow && (
        <GuestRegistrationModal
          showId={nextShow.id}
          picks={guestPicks}
          onClose={() => setGuestPicks(null)}
        />
      )}

      {/* Scoring Section */}
      <section className="py-20 bg-[#1e3340] relative z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="max-w-3xl mx-auto">
            <h2 className="text-3xl sm:text-4xl font-bold text-center text-white mb-12">
              Scoring
            </h2>

            <div className="bg-[#2d4654] border border-[#3d5a6c]/50 rounded-2xl overflow-hidden relative z-10">
              <div className="divide-y divide-[#3d5a6c]/50">
                <div className="flex items-center justify-between gap-4 p-6">
                  <div className="flex items-center space-x-4 min-w-0">
                    <Target className="h-6 w-6 text-[#c23a3a] flex-shrink-0" />
                    <div className="min-w-0">
                      <p className="font-semibold text-white">Opener Pick</p>
                      <p className="text-sm text-gray-400">
                        Call the first song of Set 1
                      </p>
                    </div>
                  </div>
                  <span className="text-2xl font-bold text-[#c23a3a] whitespace-nowrap flex-shrink-0">
                    3 pts
                  </span>
                </div>

                <div className="flex items-center justify-between gap-4 p-6">
                  <div className="flex items-center space-x-4 min-w-0">
                    <Target className="h-6 w-6 text-[#c23a3a] flex-shrink-0" />
                    <div className="min-w-0">
                      <p className="font-semibold text-white">Encore Pick</p>
                      <p className="text-sm text-gray-400">
                        Pick any song from the encore
                      </p>
                    </div>
                  </div>
                  <span className="text-2xl font-bold text-[#c23a3a] whitespace-nowrap flex-shrink-0">
                    3 pts
                  </span>
                </div>

                <div className="flex items-center justify-between gap-4 p-6">
                  <div className="flex items-center space-x-4 min-w-0">
                    <Target className="h-6 w-6 text-gray-400 flex-shrink-0" />
                    <div className="min-w-0">
                      <p className="font-semibold text-white">
                        Regular Picks (11)
                      </p>
                      <p className="text-sm text-gray-400">
                        Any song played anywhere in the show
                      </p>
                    </div>
                  </div>
                  <span className="text-2xl font-bold text-gray-300 whitespace-nowrap flex-shrink-0">
                    1 pt each
                  </span>
                </div>

                <div className="flex items-center justify-between gap-4 p-6 bg-[#3d5a6c]/30">
                  <p className="font-semibold text-white">Maximum Points</p>
                  <span className="text-2xl font-bold text-white whitespace-nowrap flex-shrink-0">
                    17 pts
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 bg-gradient-to-b from-transparent to-[#c23a3a]/10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-3xl sm:text-4xl font-bold text-white mb-6">
            Your Couch Tour Just Got Competitive
          </h2>
          <p className="text-lg text-gray-300 mb-8 max-w-xl mx-auto">
            Stop arguing in the group chat about who called it. Join the game,
            make your picks, and let the scoreboard do the talking.
          </p>
          <Link href="/register">
            <Button size="lg">
              Create Your Account
              <ArrowRight className="ml-2 h-5 w-5" />
            </Button>
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-[#3d5a6c]/50 py-8 bg-[#1e3340] relative z-10 shadow-[0_100vh_0_100vh_#1e3340]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center space-x-2">
              <DonutLogo size="sm" />
              <span className="font-semibold text-white">FantasyPhish</span>
            </div>
            <div className="flex flex-col items-center sm:items-end gap-1">
              <p className="text-sm text-gray-400">
                Setlist data provided by{" "}
                <a
                  href="https://phish.net"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[#c23a3a] hover:text-[#d64545]"
                >
                  phish.net
                </a>
              </p>
              <p className="text-sm text-gray-500 flex items-end gap-2">
                <span className="pb-1">
                  made by{" "}
                  <a
                    href="mailto:chalupa@fantasyphish.com"
                    className="hover:text-gray-400 transition-colors"
                  >
                    chalupa
                  </a>
                </span>
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="w-10 h-10"
                >
                  <path
                    d="M4 20C4 20 4 12 12 12C20 12 20 20 20 20H4Z"
                    fill="currentColor"
                    opacity="0.2"
                  />
                  <path d="M4 20C4 20 4 12 12 12C20 12 20 20 20 20" />
                  <circle cx="8" cy="16" r="0.8" fill="currentColor" />
                  <circle cx="12" cy="15" r="0.8" fill="currentColor" />
                  <circle cx="16" cy="16" r="0.8" fill="currentColor" />
                  <path d="M6 18L18 18" strokeWidth="1" />
                </svg>
              </p>
            </div>
          </div>
        </div>
      </footer>
    </div>
  )
}
