/// <reference lib="webworker" />

import type { PrecacheEntry, SerwistGlobalConfig } from "serwist"
import { Serwist } from "serwist"

declare global {
  interface WorkerGlobalScope extends SerwistGlobalConfig {
    __SW_MANIFEST: (PrecacheEntry | string)[] | undefined
  }
}

declare const self: ServiceWorkerGlobalScope

// Precache the static build output only. No runtime caching rules are
// registered here on purpose: pages and /api/* responses are live data
// (scores, leaderboards, results) that must never be served stale.
const serwist = new Serwist({
  precacheEntries: self.__SW_MANIFEST,
  skipWaiting: true,
  clientsClaim: true,
  navigationPreload: false,
  runtimeCaching: [],
})

serwist.addEventListeners()

// Tracks the app-icon badge count (unseen push notifications) across SW
// restarts via the Cache Storage API, since a service worker has no other
// simple persistent storage. Cleared when a notification is tapped or the
// app is brought to the foreground (see ClearAppBadge.tsx).
const BADGE_CACHE = "badge-count-v1"

async function getBadgeCount(): Promise<number> {
  const cache = await caches.open(BADGE_CACHE)
  const res = await cache.match("count")
  return res ? parseInt(await res.text(), 10) || 0 : 0
}

async function setBadgeCount(count: number): Promise<void> {
  const cache = await caches.open(BADGE_CACHE)
  await cache.put("count", new Response(String(count)))
  const navigatorWithBadge = self.navigator as Navigator & {
    setAppBadge?: (count?: number) => Promise<void>
    clearAppBadge?: () => Promise<void>
  }
  if (count > 0) {
    await navigatorWithBadge.setAppBadge?.(count)
  } else {
    await navigatorWithBadge.clearAppBadge?.()
  }
}

self.addEventListener("push", (event) => {
  let data: { title?: string; body?: string; url?: string } = {}
  try {
    data = event.data?.json() ?? {}
  } catch {
    // Malformed/empty payload - fall back to a generic notification.
  }
  event.waitUntil(
    (async () => {
      await self.registration.showNotification(data.title ?? "FantasyPhish", {
        body: data.body,
        icon: "/android-chrome-192x192.png",
        badge: "/android-chrome-192x192.png",
        data: { url: data.url ?? "/" },
      })
      await setBadgeCount((await getBadgeCount()) + 1)
    })()
  )
})

self.addEventListener("notificationclick", (event) => {
  event.notification.close()
  const url = event.notification.data?.url ?? "/"
  event.waitUntil(
    (async () => {
      await setBadgeCount(0)
      const clientList = await self.clients.matchAll({ type: "window" })
      const existing = clientList.find((client) => client.url.includes(url))
      if (existing) {
        await existing.focus()
      } else {
        await self.clients.openWindow(url)
      }
    })()
  )
})

self.addEventListener("message", (event) => {
  if (event.data?.type === "CLEAR_BADGE") {
    event.waitUntil(setBadgeCount(0))
  }
})
