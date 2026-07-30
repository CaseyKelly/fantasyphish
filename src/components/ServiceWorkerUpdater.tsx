"use client"

import { useEffect } from "react"

// The service worker (src/app/sw.ts) uses skipWaiting + clientsClaim, so a
// newly deployed version activates and takes control of open clients as
// soon as it's installed. A normal browser tab picks up new deploys simply
// by being reloaded/renavigated, but a home-screen PWA is often left
// backgrounded across deploys and never gets that fresh navigation - so we
// actively check for updates and reload once a new worker takes over.
export function ServiceWorkerUpdater() {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return

    const hadController = !!navigator.serviceWorker.controller
    let reloading = false

    function handleControllerChange() {
      // This also fires the first time a page is ever controlled; only
      // reload when an existing controller is being replaced by a new one.
      if (!hadController || reloading) return
      reloading = true
      window.location.reload()
    }

    function checkForUpdate() {
      navigator.serviceWorker
        .getRegistration()
        .then((registration) => registration?.update())
        .catch(() => {})
    }

    function handleVisibilityChange() {
      if (document.visibilityState === "visible") checkForUpdate()
    }

    navigator.serviceWorker.addEventListener(
      "controllerchange",
      handleControllerChange
    )
    document.addEventListener("visibilitychange", handleVisibilityChange)
    window.addEventListener("focus", checkForUpdate)
    checkForUpdate()

    return () => {
      navigator.serviceWorker.removeEventListener(
        "controllerchange",
        handleControllerChange
      )
      document.removeEventListener("visibilitychange", handleVisibilityChange)
      window.removeEventListener("focus", checkForUpdate)
    }
  }, [])

  return null
}
