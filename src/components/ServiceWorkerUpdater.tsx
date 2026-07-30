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

    let hadController = !!navigator.serviceWorker.controller
    let reloading = false

    function handleControllerChange() {
      if (reloading) return
      // This also fires the first time a page is ever controlled; skip only
      // that initial transition, then reload on every controller replacement
      // after it (i.e. every later deploy that takes over this session).
      if (!hadController) {
        hadController = true
        return
      }
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
