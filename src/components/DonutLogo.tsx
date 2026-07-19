"use client"

import { useRef } from "react"
import { EASTER_EGG_OPEN_EVENT } from "./EasterEgg"

interface DonutLogoProps {
  size?: "sm" | "md" | "lg" | "xl"
  className?: string
}

const sizes = {
  sm: "w-6 h-6",
  md: "w-8 h-8",
  lg: "w-10 h-10",
  xl: "w-16 h-16",
}

// Long-press the logo to trigger the hidden game on touch devices,
// where there's no keyboard for the Konami code.
const LONG_PRESS_MS = 900
const MOVE_CANCEL_PX = 12

export function DonutLogo({ size = "md", className = "" }: DonutLogoProps) {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const triggeredRef = useRef(false)
  const startRef = useRef({ x: 0, y: 0 })

  const clearTimer = () => {
    if (timerRef.current) {
      clearTimeout(timerRef.current)
      timerRef.current = null
    }
  }

  const handlePointerDown = (e: React.PointerEvent) => {
    if (e.pointerType === "mouse" && e.button !== 0) return
    triggeredRef.current = false
    startRef.current = { x: e.clientX, y: e.clientY }
    clearTimer()
    timerRef.current = setTimeout(() => {
      triggeredRef.current = true
      window.dispatchEvent(new Event(EASTER_EGG_OPEN_EVENT))
    }, LONG_PRESS_MS)
  }

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!timerRef.current) return
    const dx = e.clientX - startRef.current.x
    const dy = e.clientY - startRef.current.y
    if (Math.hypot(dx, dy) > MOVE_CANCEL_PX) clearTimer()
  }

  const handlePointerEnd = () => clearTimer()

  // A long-press on a link/button would otherwise still fire the
  // eventual click and navigate away right as the game opens.
  const handleClickCapture = (e: React.MouseEvent) => {
    if (triggeredRef.current) {
      e.preventDefault()
      e.stopPropagation()
      triggeredRef.current = false
    }
  }

  return (
    <svg
      viewBox="0 0 120 120"
      className={`${sizes[size]} ${className} select-none [-webkit-touch-callout:none]`}
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerEnd}
      onPointerCancel={handlePointerEnd}
      onPointerLeave={handlePointerEnd}
      onContextMenu={(e) => e.preventDefault()}
      onClickCapture={handleClickCapture}
    >
      {/* Outer circle (donut) - thicker stroke */}
      <circle
        cx="60"
        cy="60"
        r="40"
        stroke="#c23a3a"
        strokeWidth="24"
        fill="none"
      />
    </svg>
  )
}

export function DonutLogoWithText({
  size = "md",
  className = "",
}: DonutLogoProps) {
  return (
    <div className={`flex items-center space-x-2 ${className}`}>
      <DonutLogo size={size} />
      <span className="font-bold text-white">FantasyPhish</span>
    </div>
  )
}
