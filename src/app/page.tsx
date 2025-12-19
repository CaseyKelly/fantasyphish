import Link from "next/link"
import { Target, Trophy, Calendar, ArrowRight, Music } from "lucide-react"
import { Button } from "@/components/ui/button"
import { DonutLogo } from "@/components/DonutLogo"

export default function LandingPage() {
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
              {/* First row */}
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
              {/* Second row - offset */}
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

        <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20 sm:py-32">
          <div className="text-center">
            <h1 className="text-4xl sm:text-6xl lg:text-7xl font-bold text-white mb-6">
              You Knew{" "}
              <span className="text-[#c23a3a]">
                They&apos;d Bust Out Fluffhead
              </span>
            </h1>
            <p className="text-lg sm:text-xl text-gray-300 max-w-2xl mx-auto mb-10">
              Now prove it. Pick 13 songs before showtime, rack up points when
              Trey plays your calls, and show the lot who really knows
              what&apos;s coming.
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <Link href="/register">
                <Button size="lg" className="w-full sm:w-auto">
                  Start Playing
                  <ArrowRight className="ml-2 h-5 w-5" />
                </Button>
              </Link>
              <Link href="/register">
                <Button
                  variant="outline"
                  size="lg"
                  className="w-full sm:w-auto"
                >
                  View Leaderboard
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </header>

      {/* How It Works */}
      <section className="py-20 bg-[#1e3340] relative z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-3xl sm:text-4xl font-bold text-center text-white mb-12">
            It&apos;s Easy (Unlike Getting Tickets)
          </h2>

          <div className="grid md:grid-cols-3 gap-8">
            {/* Step 1 */}
            <div className="text-center p-6">
              <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-[#c23a3a]/20 mb-6">
                <Music className="h-8 w-8 text-[#c23a3a]" />
              </div>
              <h3 className="text-xl font-semibold text-white mb-3">
                Make Your Calls
              </h3>
              <p className="text-gray-400">
                Pick your opener (3 pts), encore (3 pts), and 11 deep cuts (1 pt
                each) from over 800 songs. Will they open with Ghost again? Is
                tonight the night for Harpua? You tell us.
              </p>
            </div>

            {/* Step 2 */}
            <div className="text-center p-6">
              <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-[#c23a3a]/20 mb-6">
                <Calendar className="h-8 w-8 text-[#c23a3a]" />
              </div>
              <h3 className="text-xl font-semibold text-white mb-3">
                Lock It In
              </h3>
              <p className="text-gray-400">
                Get your picks in before Page hits that first chord. Once the
                lights go down, no take-backsies. This isn&apos;t soundcheck.
              </p>
            </div>

            {/* Step 3 */}
            <div className="text-center p-6">
              <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-[#c23a3a]/20 mb-6">
                <Trophy className="h-8 w-8 text-[#c23a3a]" />
              </div>
              <h3 className="text-xl font-semibold text-white mb-3">
                Earn Bragging Rights
              </h3>
              <p className="text-gray-400">
                We auto-score after the last encore. Climb the tour leaderboard,
                flex on your crew, and accept your title as the biggest wook.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Scoring Section */}
      <section className="py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="max-w-3xl mx-auto">
            <h2 className="text-3xl sm:text-4xl font-bold text-center text-white mb-12">
              Scoring
            </h2>

            <div className="bg-[#1e3340] border border-[#3d5a6c]/50 rounded-2xl overflow-hidden relative z-10">
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
