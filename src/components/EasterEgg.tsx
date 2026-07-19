"use client"

import { useEffect, useRef, useState } from "react"
import { X } from "lucide-react"
import { DonutCatchGame } from "./DonutCatchGame"

// Desktop: the classic Konami code (needs arrow keys). Mobile: tap the
// hidden dot in the corner 5 times fast — long-press on a link runs into
// the OS's own "peek this link" gesture, which we can't reliably beat.
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

const TAP_TRIGGER_COUNT = 5
const TAP_TRIGGER_WINDOW_MS = 1800

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
  const tapCountRef = useRef(0)
  const lastTapRef = useRef(0)

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

  const handleSecretTap = () => {
    const now = Date.now()
    if (now - lastTapRef.current > TAP_TRIGGER_WINDOW_MS) {
      tapCountRef.current = 0
    }
    lastTapRef.current = now
    tapCountRef.current += 1
    if (tapCountRef.current >= TAP_TRIGGER_COUNT) {
      tapCountRef.current = 0
      setOpen(true)
    }
  }

  return (
    <>
      {!open && (
        <button
          type="button"
          onClick={handleSecretTap}
          tabIndex={-1}
          aria-hidden="true"
          className="fixed bottom-0 right-0 z-[150] flex h-11 w-11 items-center justify-center"
        >
          <span className="h-2 w-2 rounded-full bg-[#c23a3a]/15" />
        </button>
      )}

      {open && (
        <div className="fixed inset-0 bg-black/70 z-[200] flex items-center justify-center p-4">
          <div className="bg-[#2d4654] rounded-xl shadow-xl p-4 sm:p-6 relative max-h-[90vh] overflow-y-auto">
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
      )}
    </>
  )
}
