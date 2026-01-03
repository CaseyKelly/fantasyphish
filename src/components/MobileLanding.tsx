"use client"

import Link from "next/link"
import { Button } from "@/components/ui/button"
import { DonutLogo } from "@/components/DonutLogo"
import { LogIn, UserPlus } from "lucide-react"

export function MobileLanding() {
  return (
    <div className="min-h-screen bg-[#2d4654] flex flex-col items-center justify-center px-6 relative overflow-hidden">
      {/* Subtle background pattern */}
      <div className="absolute inset-0 opacity-5 pointer-events-none">
        <svg width="100%" height="100%">
          <defs>
            <pattern
              id="mobile-donut-pattern"
              x="0"
              y="0"
              width="100"
              height="100"
              patternUnits="userSpaceOnUse"
            >
              <circle
                cx="50"
                cy="50"
                r="30"
                stroke="#c23a3a"
                strokeWidth="8"
                fill="none"
              />
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#mobile-donut-pattern)" />
        </svg>
      </div>

      {/* Content */}
      <div className="relative z-10 flex flex-col items-center text-center max-w-md">
        {/* Logo */}
        <div className="mb-8 animate-in fade-in duration-500">
          <DonutLogo size="xl" className="mb-6" />
          <h1 className="text-4xl font-bold text-white mb-2">FantasyPhish</h1>
          <p className="text-lg text-gray-300">
            Predict the setlist. Rack up points. Prove you know Phish.
          </p>
        </div>

        {/* Description */}
        <div className="mb-12 space-y-3 text-gray-300 animate-in fade-in slide-in-from-bottom-4 duration-500 delay-150">
          <p className="text-base">
            Pick 13 songs before showtime and compete on the leaderboard.
          </p>
          <p className="text-sm text-gray-400">
            Score points when your picks get played. It&apos;s like fantasy
            football, but for Phish fans.
          </p>
        </div>

        {/* Action Buttons */}
        <div className="w-full space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-500 delay-300">
          <Link href="/register" className="block">
            <Button size="lg" className="w-full text-lg py-6">
              <UserPlus className="h-5 w-5 mr-2" />
              Create Account
            </Button>
          </Link>

          <Link href="/login" className="block">
            <Button
              size="lg"
              variant="outline"
              className="w-full text-lg py-6 bg-transparent border-gray-600 text-white hover:bg-white/10"
            >
              <LogIn className="h-5 w-5 mr-2" />
              Sign In
            </Button>
          </Link>
        </div>

        {/* Footer note */}
        <div className="mt-12 text-xs text-gray-500 animate-in fade-in duration-500 delay-500">
          <p>
            Data from{" "}
            <a
              href="https://phish.net"
              target="_blank"
              rel="noopener noreferrer"
              className="text-[#c23a3a] hover:text-[#d64545]"
            >
              phish.net
            </a>
          </p>
        </div>
      </div>
    </div>
  )
}
