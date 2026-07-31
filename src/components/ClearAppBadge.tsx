"use client"

import { useEffect } from "react"

// Clears the home-screen icon badge (set in src/app/sw.ts on push) whenever
// the app is brought to the foreground, since opening the app counts as
// having seen whatever the badge was counting.
export function ClearAppBadge() {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return

    function clearBadge() {
      const navigatorWithBadge = navigator as Navigator & {
        clearAppBadge?: () => Promise<void>
      }
      navigatorWithBadge.clearAppBadge?.().catch(() => {})
      navigator.serviceWorker.ready
        .then((registration) =>
          registration.active?.postMessage({ type: "CLEAR_BADGE" })
        )
        .catch(() => {})
    }

    function handleVisibilityChange() {
      if (document.visibilityState === "visible") clearBadge()
    }

    document.addEventListener("visibilitychange", handleVisibilityChange)
    window.addEventListener("focus", clearBadge)
    clearBadge()

    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange)
      window.removeEventListener("focus", clearBadge)
    }
  }, [])

  return null
}
