"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { signOut, useSession } from "next-auth/react"
import { useState, useEffect } from "react"
import {
  Menu,
  X,
  Music,
  Trophy,
  ClipboardList,
  LogOut,
  User,
  Users,
} from "lucide-react"
import { DonutLogo } from "./DonutLogo"

type UserForImpersonation = {
  id: string
  username: string
  email: string
  isAdmin: boolean
}

export function Navbar() {
  const pathname = usePathname()
  const { data: session, update } = useSession()
  const [isMenuOpen, setIsMenuOpen] = useState(false)
  const [showImpersonateModal, setShowImpersonateModal] = useState(false)
  const [users, setUsers] = useState<UserForImpersonation[]>([])
  const [loadingUsers, setLoadingUsers] = useState(false)
  const [impersonating, setImpersonating] = useState(false)

  // Check if user is admin (original user if impersonating)
  const isAdmin = session?.impersonating
    ? session.impersonating.originalIsAdmin
    : session?.user.isAdmin

  // Check if in non-prod environment (client-side check via API availability)
  const [isNonProd, setIsNonProd] = useState(false)

  useEffect(() => {
    // Check if admin features are available by trying to fetch users
    // In non-prod, the endpoint will return 200 (if admin) or 403 (if not admin, but endpoint exists)
    // In prod, the endpoint returns 403 with a specific "non-production" error message
    if (isAdmin) {
      fetch("/api/admin/users")
        .then((res) => {
          // Only consider it non-prod if we get a successful response
          setIsNonProd(res.ok)
        })
        .catch(() => setIsNonProd(false))
    }
  }, [isAdmin])

  const navItems = [
    { href: "/picks", label: "My Picks", icon: Music },
    { href: "/results", label: "Results", icon: ClipboardList },
    { href: "/leaderboard", label: "Leaderboard", icon: Trophy },
  ]

  const isActive = (href: string) => pathname === href

  const handleOpenImpersonateModal = async () => {
    setShowImpersonateModal(true)
    setLoadingUsers(true)
    try {
      const response = await fetch("/api/admin/users")
      if (response.ok) {
        const data = await response.json()
        setUsers(data.users)
      }
    } catch (error) {
      console.error("Failed to load users:", error)
    } finally {
      setLoadingUsers(false)
    }
  }

  const handleImpersonate = async (userId: string) => {
    setImpersonating(true)
    try {
      const response = await fetch("/api/admin/impersonate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId }),
      })

      if (!response.ok) {
        throw new Error("Failed to impersonate user")
      }

      const data = await response.json()

      // Update the session with impersonation data
      await update({
        impersonating: {
          originalUserId: data.impersonation.originalUserId,
          originalUsername: data.impersonation.originalUsername,
          originalIsAdmin: data.impersonation.originalIsAdmin,
          targetUserId: data.impersonation.targetUser.id,
          targetUsername: data.impersonation.targetUser.username,
          targetEmail: data.impersonation.targetUser.email,
          targetIsAdmin: data.impersonation.targetUser.isAdmin,
        },
      })

      // Close modal and reload page to show impersonated user
      setShowImpersonateModal(false)
      window.location.reload()
    } catch (error) {
      console.error("Failed to impersonate:", error)
      alert("Failed to impersonate user. Please try again.")
      setImpersonating(false)
    }
  }

  return (
    <>
      <nav className="sticky top-0 z-50 bg-[#2d4654]/95 backdrop-blur-sm border-b border-[#3d5a6c]/50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            {/* Logo */}
            <Link
              href={session ? "/picks" : "/"}
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
                {isAdmin && isNonProd && (
                  <button
                    onClick={handleOpenImpersonateModal}
                    className="flex items-center space-x-2 px-3 py-2 rounded-lg text-sm font-medium text-amber-400 hover:text-amber-300 hover:bg-[#3d5a6c]/50 transition-colors whitespace-nowrap"
                  >
                    <Users className="h-4 w-4 flex-shrink-0" />
                    <span>Impersonate</span>
                  </button>
                )}
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
                {isAdmin && isNonProd && (
                  <button
                    onClick={() => {
                      setIsMenuOpen(false)
                      handleOpenImpersonateModal()
                    }}
                    className="flex items-center space-x-3 w-full px-4 py-3 rounded-lg text-sm font-medium text-amber-400 hover:text-amber-300 hover:bg-[#3d5a6c]/50 transition-colors"
                  >
                    <Users className="h-5 w-5" />
                    <span>Impersonate User</span>
                  </button>
                )}
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

      {/* Impersonation Modal - Outside nav for proper z-index */}
      {showImpersonateModal && (
        <div className="fixed inset-0 bg-black/50 z-[100] flex items-center justify-center p-4">
          <div className="bg-[#2d4654] rounded-lg shadow-xl max-w-2xl w-full max-h-[80vh] flex flex-col">
            <div className="flex items-center justify-between p-6 border-b border-[#3d5a6c]/50">
              <h2 className="text-xl font-bold text-white">Impersonate User</h2>
              <button
                onClick={() => setShowImpersonateModal(false)}
                className="text-gray-400 hover:text-white transition-colors"
              >
                <X className="h-6 w-6" />
              </button>
            </div>
            <div className="overflow-y-auto flex-1 p-6">
              {loadingUsers ? (
                <p className="text-gray-400 text-center">Loading users...</p>
              ) : users.length === 0 ? (
                <p className="text-gray-400 text-center">No users found</p>
              ) : (
                <div className="space-y-2">
                  {users.map((user) => (
                    <button
                      key={user.id}
                      onClick={() => handleImpersonate(user.id)}
                      disabled={impersonating}
                      className="w-full flex items-center justify-between p-4 rounded-lg bg-[#3d5a6c]/30 hover:bg-[#3d5a6c]/50 transition-colors text-left disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <div>
                        <p className="font-medium text-white">
                          {user.username}
                          {user.isAdmin && (
                            <span className="ml-2 text-xs text-amber-400">
                              (Admin)
                            </span>
                          )}
                        </p>
                        <p className="text-sm text-gray-400">{user.email}</p>
                      </div>
                      <Users className="h-5 w-5 text-gray-400" />
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  )
}
