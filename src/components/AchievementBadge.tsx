"use client"

import * as LucideIcons from "lucide-react"
import { useLayoutEffect, useRef, useState } from "react"

const TOOLTIP_VIEWPORT_MARGIN = 8

interface AchievementBadgeProps {
  icon: string
  name: string
  description?: string
}

export function AchievementBadge({
  icon,
  name,
  description,
}: AchievementBadgeProps) {
  const [showTooltip, setShowTooltip] = useState(false)
  const [tooltipOffset, setTooltipOffset] = useState(0)
  const [arrowOffset, setArrowOffset] = useState(0)
  const [placement, setPlacement] = useState<"above" | "below">("above")
  const cardRef = useRef<HTMLDivElement>(null)
  const tooltipRef = useRef<HTMLDivElement>(null)

  useLayoutEffect(() => {
    if (!showTooltip) return

    const recalculate = () => {
      const card = cardRef.current
      const tooltip = tooltipRef.current
      if (!card || !tooltip) return

      const cardRect = card.getBoundingClientRect()
      const tooltipRect = tooltip.getBoundingClientRect()
      const naturalLeft =
        cardRect.left + cardRect.width / 2 - tooltipRect.width / 2
      const naturalRight = naturalLeft + tooltipRect.width

      let shift = 0
      if (naturalLeft < TOOLTIP_VIEWPORT_MARGIN) {
        shift = TOOLTIP_VIEWPORT_MARGIN - naturalLeft
      } else if (naturalRight > window.innerWidth - TOOLTIP_VIEWPORT_MARGIN) {
        shift = window.innerWidth - TOOLTIP_VIEWPORT_MARGIN - naturalRight
      }

      setTooltipOffset(shift)
      setArrowOffset(-shift)

      const fitsAbove =
        cardRect.top - tooltipRect.height - TOOLTIP_VIEWPORT_MARGIN >= 0
      setPlacement(fitsAbove ? "above" : "below")
    }

    recalculate()
    window.addEventListener("resize", recalculate)
    return () => window.removeEventListener("resize", recalculate)
  }, [showTooltip])

  // Check if icon is a lucide icon name or emoji
  const isLucideIcon = icon in LucideIcons
  const LucideIcon = isLucideIcon
    ? (LucideIcons[icon as keyof typeof LucideIcons] as React.ComponentType<{
        className?: string
      }>)
    : null

  return (
    <div
      ref={cardRef}
      className={`relative flex flex-col items-center space-y-2 p-4 bg-[#1e3340]/60 border border-[#3d5a6c]/50 rounded-lg hover:bg-[#1e3340]/80 hover:border-[#3d5a6c] transition-all duration-200 ${description ? "cursor-help" : ""}`}
      onMouseEnter={() => description && setShowTooltip(true)}
      onMouseLeave={() => description && setShowTooltip(false)}
    >
      {/* Tooltip */}
      {description && showTooltip && (
        <div
          ref={tooltipRef}
          className={`absolute left-1/2 max-w-[min(240px,80vw)] px-3 py-2 bg-slate-900 text-white text-xs rounded-lg shadow-lg whitespace-normal z-10 border border-slate-700 ${placement === "above" ? "bottom-full mb-2" : "top-full mt-2"}`}
          style={{
            transform: `translateX(-50%) translateX(${tooltipOffset}px)`,
          }}
        >
          {description}
          <div
            className={`absolute left-1/2 border-4 border-transparent ${placement === "above" ? "top-full -mt-1 border-t-slate-900" : "bottom-full -mb-1 border-b-slate-900"}`}
            style={{
              transform: `translateX(-50%) translateX(${arrowOffset}px)`,
            }}
          />
        </div>
      )}

      {/* Icon */}
      <div className="flex items-center justify-center w-16 h-16">
        {isLucideIcon && LucideIcon ? (
          <LucideIcon className="w-12 h-12 text-[#c23a3a]" />
        ) : (
          <span className="text-5xl">{icon}</span>
        )}
      </div>

      {/* Name */}
      <div className="text-center">
        <p className="text-sm font-semibold text-white">{name}</p>
      </div>
    </div>
  )
}
