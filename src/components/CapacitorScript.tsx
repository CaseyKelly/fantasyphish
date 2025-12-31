"use client"

import { useEffect } from "react"

/**
 * Component that loads Capacitor bridge scripts when running in native app
 * This is needed because the app loads from a remote URL
 */
export function CapacitorScript() {
  useEffect(() => {
    // Check if we're in a Capacitor environment
    const isCapacitor =
      typeof window !== "undefined" &&
      (window.location.protocol === "capacitor:" ||
        window.location.protocol === "ionic:")

    if (isCapacitor) {
      // Capacitor is already loaded in the native app, we just need to verify
      console.log("Running in Capacitor native app")
    }
  }, [])

  return null
}
