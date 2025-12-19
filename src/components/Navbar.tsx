"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { signOut, useSession } from "next-auth/react"
import { useState } from "react"
import {
  Menu,
  X,
  Music,
  Trophy,
  ClipboardList,
  LogOut,
  User,
} from "lucide-react"
import { DonutLogo } from "./DonutLogo"

export function Navbar() {
  const pathname = usePathname()
  const { data: session } = useSession()
  const [isMenuOpen, setIsMenuOpen] = useState(false)

  const navItems = [
    { href: "/dashboard", label: "My Picks", icon: Music },
    { href: "/history", label: "Results", icon: ClipboardList },
    { href: "/leaderboard", label: "Leaderboard", icon: Trophy },
  ]

  const isActive = (href: string) => pathname === href

  return (
    <nav className="sticky top-0 z-50 bg-[#2d4654]/95 backdrop-blur-sm border-b border-[#3d5a6c]/50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <Link
            href={session ? "/dashboard" : "/"}
            className="flex items-center space-x-2"
          >
            <DonutLogo size="md" />
            <span className="text-xl font-bold text-white">FantasyPhish</span>
          </Link>

          {/* Desktop Nav */}
          {session && (
            <div className="hidden md:flex items-center space-x-1">
              {navItems.map((item) => {
                const Icon = item.icon
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={`flex items-center space-x-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors whitespace-nowrap ${
                      isActive(item.href)
                        ? "bg-[#c23a3a]/20 text-[#d64545]"
                        : "text-gray-300 hover:text-white hover:bg-[#3d5a6c]/50"
                    }`}
                  >
                    <Icon className="h-4 w-4 flex-shrink-0" />
                    <span>{item.label}</span>
                  </Link>
                )
              })}
            </div>
          )}

          {/* User Menu (Desktop) */}
          {session && (
            <div className="hidden md:flex items-center space-x-4">
              <Link
                href="/profile"
                className="flex items-center space-x-2 px-3 py-2 rounded-lg text-sm font-medium text-gray-300 hover:text-white hover:bg-[#3d5a6c]/50 transition-colors whitespace-nowrap"
              >
                <User className="h-4 w-4 flex-shrink-0" />
                <span className="truncate max-w-[150px]">
                  {session.user.username}
                </span>
              </Link>
              <button
                onClick={() => signOut({ callbackUrl: "/" })}
                className="flex items-center space-x-2 px-3 py-2 rounded-lg text-sm font-medium text-gray-300 hover:text-white hover:bg-[#3d5a6c]/50 transition-colors whitespace-nowrap"
              >
                <LogOut className="h-4 w-4 flex-shrink-0" />
                <span>Sign Out</span>
              </button>
            </div>
          )}

          {/* Mobile menu button */}
          {session && (
            <button
              onClick={() => setIsMenuOpen(!isMenuOpen)}
              className="md:hidden p-2 rounded-lg text-gray-400 hover:text-white hover:bg-[#3d5a6c]/50"
            >
              {isMenuOpen ? (
                <X className="h-6 w-6" />
              ) : (
                <Menu className="h-6 w-6" />
              )}
            </button>
          )}

          {/* Auth buttons (when not logged in) */}
          {!session && (
            <div className="flex items-center space-x-3">
              <Link
                href="/login"
                className="px-4 py-2 text-sm font-medium text-gray-300 hover:text-white transition-colors"
              >
                Log In
              </Link>
              <Link
                href="/register"
                className="px-4 py-2 text-sm font-medium bg-[#c23a3a] hover:bg-[#d64545] text-white rounded-lg transition-colors"
              >
                Sign Up
              </Link>
            </div>
          )}
        </div>
      </div>

      {/* Mobile menu */}
      {session && isMenuOpen && (
        <div className="md:hidden border-t border-[#3d5a6c]/50">
          <div className="px-4 py-3 space-y-1">
            {navItems.map((item) => {
              const Icon = item.icon
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setIsMenuOpen(false)}
                  className={`flex items-center space-x-3 px-4 py-3 rounded-lg text-sm font-medium transition-colors ${
                    isActive(item.href)
                      ? "bg-[#c23a3a]/20 text-[#d64545]"
                      : "text-gray-300 hover:text-white hover:bg-[#3d5a6c]/50"
                  }`}
                >
                  <Icon className="h-5 w-5" />
                  <span>{item.label}</span>
                </Link>
              )
            })}
            <div className="pt-3 mt-3 border-t border-[#3d5a6c]/50">
              <Link
                href="/profile"
                onClick={() => setIsMenuOpen(false)}
                className="flex items-center space-x-3 px-4 py-3 rounded-lg text-sm font-medium text-gray-300 hover:text-white hover:bg-[#3d5a6c]/50 transition-colors"
              >
                <User className="h-5 w-5" />
                <span>{session.user.username}</span>
              </Link>
              <button
                onClick={() => signOut({ callbackUrl: "/" })}
                className="flex items-center space-x-3 w-full px-4 py-3 rounded-lg text-sm font-medium text-gray-300 hover:text-white hover:bg-[#3d5a6c]/50 transition-colors"
              >
                <LogOut className="h-5 w-5" />
                <span>Sign Out</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </nav>
  )
}
