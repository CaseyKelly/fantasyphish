"use client"

import { useEffect, useRef, useState } from "react"
import { X } from "lucide-react"
import { DonutCatchGame } from "./DonutCatchGame"

// Same secret sequence in two alphabets: arrow keys + b/a on desktop,
// swipes + two taps on touch devices ("b" and "a" both satisfied by a tap).
const KONAMI_CODE = [
  "up",
  "up",
  "down",
  "down",
  "left",
  "right",
  "left",
  "right",
  "b",
  "a",
]

const SWIPE_THRESHOLD = 40
const TAP_THRESHOLD = 15

const KEY_TO_TOKEN: Record<string, string> = {
  ArrowUp: "up",
  ArrowDown: "down",
  ArrowLeft: "left",
  ArrowRight: "right",
  b: "b",
  a: "a",
}

export function EasterEgg() {
  const [open, setOpen] = useState(false)
  const openRef = useRef(false)

  useEffect(() => {
    openRef.current = open
  }, [open])

  useEffect(() => {
    let progress = 0

    const processToken = (token: string) => {
      if (openRef.current) return
      const expected = KONAMI_CODE[progress]
      const matches =
        token === expected ||
        (token === "tap" && (expected === "b" || expected === "a"))

      if (matches) {
        progress += 1
        if (progress === KONAMI_CODE.length) {
          setOpen(true)
          progress = 0
        }
      } else {
        progress = token === KONAMI_CODE[0] ? 1 : 0
      }
    }

    const isTypingTarget = (target: EventTarget | null) => {
      const el = target as HTMLElement | null
      return (
        !!el &&
        (el.tagName === "INPUT" ||
          el.tagName === "TEXTAREA" ||
          el.isContentEditable)
      )
    }

    const handleKeyDown = (e: KeyboardEvent) => {
      if (isTypingTarget(e.target)) return
      const key = e.key.length === 1 ? e.key.toLowerCase() : e.key
      const token = KEY_TO_TOKEN[key]
      if (token) processToken(token)
    }

    let touchStartX = 0
    let touchStartY = 0

    const handleTouchStart = (e: TouchEvent) => {
      const touch = e.touches[0]
      touchStartX = touch.clientX
      touchStartY = touch.clientY
    }

    const handleTouchEnd = (e: TouchEvent) => {
      if (isTypingTarget(e.target)) return
      const touch = e.changedTouches[0]
      const dx = touch.clientX - touchStartX
      const dy = touch.clientY - touchStartY
      const absX = Math.abs(dx)
      const absY = Math.abs(dy)

      if (absX < TAP_THRESHOLD && absY < TAP_THRESHOLD) {
        processToken("tap")
        return
      }

      if (Math.max(absX, absY) < SWIPE_THRESHOLD) return

      const token =
        absX > absY ? (dx > 0 ? "right" : "left") : dy > 0 ? "down" : "up"
      processToken(token)
    }

    window.addEventListener("keydown", handleKeyDown)
    window.addEventListener("touchstart", handleTouchStart, { passive: true })
    window.addEventListener("touchend", handleTouchEnd, { passive: true })
    return () => {
      window.removeEventListener("keydown", handleKeyDown)
      window.removeEventListener("touchstart", handleTouchStart)
      window.removeEventListener("touchend", handleTouchEnd)
    }
  }, [])

  useEffect(() => {
    if (!open) return
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false)
    }
    window.addEventListener("keydown", handleEscape)
    return () => window.removeEventListener("keydown", handleEscape)
  }, [open])

  if (!open) return null

  return (
    <div className="fixed inset-0 bg-black/70 z-[200] flex items-center justify-center p-4">
      <div className="bg-[#2d4654] rounded-xl shadow-xl p-4 sm:p-6 relative">
        <button
          onClick={() => setOpen(false)}
          className="absolute -top-3 -right-3 bg-[#c23a3a] hover:bg-[#d64545] text-white rounded-full p-1.5 shadow-lg transition-colors"
          aria-label="Close game"
        >
          <X className="h-4 w-4" />
        </button>
        <DonutCatchGame />
      </div>
    </div>
  )
}
