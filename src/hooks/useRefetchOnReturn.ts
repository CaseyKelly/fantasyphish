"use client"

import { useEffect, useLayoutEffect, useRef } from "react"

// Refetch when the user comes back to the page after being away - e.g.
// backgrounding the PWA/tab and reopening it - instead of waiting for the
// next polling interval to tick. Browsers don't reliably fire only one of
// visibilitychange/focus on return, so both are wired up and debounced into
// a single call.
export function useRefetchOnReturn(onReturn: () => void, enabled = true) {
  const onReturnRef = useRef(onReturn)

  // Writing directly to a ref during render is disallowed (react-hooks/refs),
  // so sync it in a layout effect instead - it runs synchronously before
  // paint, so there's no gap where a visibilitychange/focus event could fire
  // against a stale callback (unlike a plain useEffect, which runs after
  // paint).
  useLayoutEffect(() => {
    onReturnRef.current = onReturn
  })

  useEffect(() => {
    if (!enabled) return

    let lastFired = 0

    function fire() {
      const now = Date.now()
      if (now - lastFired < 1000) return
      lastFired = now
      onReturnRef.current()
    }

    function handleVisibilityChange() {
      if (document.visibilityState === "visible") fire()
    }

    document.addEventListener("visibilitychange", handleVisibilityChange)
    window.addEventListener("focus", fire)

    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange)
      window.removeEventListener("focus", fire)
    }
  }, [enabled])
}
