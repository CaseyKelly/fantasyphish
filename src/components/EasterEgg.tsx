"use client"

import { useEffect, useState } from "react"
import { X } from "lucide-react"
import { DonutCatchGame } from "./DonutCatchGame"

const KONAMI_CODE = [
  "ArrowUp",
  "ArrowUp",
  "ArrowDown",
  "ArrowDown",
  "ArrowLeft",
  "ArrowRight",
  "ArrowLeft",
  "ArrowRight",
  "b",
  "a",
]

export function EasterEgg() {
  const [open, setOpen] = useState(false)

  useEffect(() => {
    let progress = 0

    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null
      const isTyping =
        target &&
        (target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.isContentEditable)
      if (isTyping) return

      const expected = KONAMI_CODE[progress]
      const key = e.key.length === 1 ? e.key.toLowerCase() : e.key

      if (key === expected) {
        progress += 1
        if (progress === KONAMI_CODE.length) {
          setOpen(true)
          progress = 0
        }
      } else {
        progress = key === KONAMI_CODE[0] ? 1 : 0
      }
    }

    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
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
