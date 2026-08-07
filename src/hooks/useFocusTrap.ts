"use client"

import { RefObject, useEffect, useLayoutEffect, useRef } from "react"

const FOCUSABLE_SELECTOR =
  'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])'

// Traps Tab focus inside a modal/dialog container, closes on Escape, and
// restores focus to whatever was focused before the modal opened. Needed
// because this app builds overlays as plain fixed divs rather than using a
// dialog primitive that handles this natively.
export function useFocusTrap(
  containerRef: RefObject<HTMLElement | null>,
  isOpen: boolean,
  onClose: () => void
) {
  const onCloseRef = useRef(onClose)

  // Keep the latest onClose without re-running the trap effect below (which
  // would refocus the first element on every render that passes a new
  // onClose reference).
  useLayoutEffect(() => {
    onCloseRef.current = onClose
  })

  useEffect(() => {
    if (!isOpen) return

    const container = containerRef.current
    const previouslyFocused = document.activeElement as HTMLElement | null

    const focusable = () =>
      Array.from(
        container?.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR) ?? []
      )

    const first = focusable()[0]
    first?.focus()

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault()
        onCloseRef.current()
        return
      }

      if (e.key !== "Tab") return

      const elements = focusable()
      if (elements.length === 0) return

      const firstEl = elements[0]
      const lastEl = elements[elements.length - 1]

      if (e.shiftKey && document.activeElement === firstEl) {
        e.preventDefault()
        lastEl.focus()
      } else if (!e.shiftKey && document.activeElement === lastEl) {
        e.preventDefault()
        firstEl.focus()
      }
    }

    document.addEventListener("keydown", handleKeyDown)

    return () => {
      document.removeEventListener("keydown", handleKeyDown)
      previouslyFocused?.focus()
    }
  }, [isOpen, containerRef])
}
