import { describe, it, expect, vi, beforeAll, beforeEach } from "vitest"

// Plain records rather than vi.fn() call history: the worker is constructed
// once at import time, and beforeEach's clearAllMocks would wipe mock.calls
const serwist = vi.hoisted(() => ({
  options: [] as unknown[],
  listenersAdded: 0,
}))
vi.mock("serwist", () => ({
  Serwist: function (opts: unknown) {
    serwist.options.push(opts)
    return {
      addEventListeners: () => {
        serwist.listenersAdded++
      },
    }
  },
}))

type Handler = (event: Record<string, unknown>) => void
const handlers: Record<string, Handler> = {}
const store = new Map<string, string>()
const showNotification = vi.fn()
const matchAll = vi.fn()
const openWindow = vi.fn()
const setAppBadge = vi.fn()
const clearAppBadge = vi.fn()

beforeAll(async () => {
  vi.stubGlobal("self", {
    __SW_MANIFEST: [{ url: "/a.js", revision: "1" }],
    addEventListener: (type: string, fn: Handler) => {
      handlers[type] = fn
    },
    registration: { showNotification },
    clients: { matchAll, openWindow },
    navigator: { setAppBadge, clearAppBadge },
  })
  vi.stubGlobal("caches", {
    open: async () => ({
      match: async (key: string) =>
        store.has(key) ? { text: async () => store.get(key)! } : undefined,
      put: async (key: string, res: Response) => {
        store.set(key, await res.text())
      },
    }),
  })
  await import("./sw")
})

beforeEach(() => {
  store.clear()
  vi.clearAllMocks()
})

/** Dispatch an event to the SW handler and wait for its waitUntil work. */
async function dispatch(type: string, event: Record<string, unknown>) {
  let pending: Promise<unknown> = Promise.resolve()
  handlers[type]({
    ...event,
    waitUntil: (p: Promise<unknown>) => {
      pending = p
    },
  })
  await pending
}

describe("service worker", () => {
  it("precaches the build manifest with no runtime caching", () => {
    expect(serwist.options).toEqual([
      {
        precacheEntries: [{ url: "/a.js", revision: "1" }],
        skipWaiting: true,
        clientsClaim: true,
        navigationPreload: false,
        runtimeCaching: [],
      },
    ])
    expect(serwist.listenersAdded).toBe(1)
  })

  it("shows push notifications and increments the badge", async () => {
    await dispatch("push", {
      data: {
        json: () => ({ title: "Show tonight", body: "Pick!", url: "/pick/1" }),
      },
    })
    expect(showNotification).toHaveBeenCalledWith("Show tonight", {
      body: "Pick!",
      icon: "/android-chrome-192x192.png",
      badge: "/android-chrome-192x192.png",
      data: { url: "/pick/1" },
    })
    expect(setAppBadge).toHaveBeenLastCalledWith(1)
    await dispatch("push", { data: null })
    expect(showNotification).toHaveBeenLastCalledWith(
      "FantasyPhish",
      expect.objectContaining({ data: { url: "/" } })
    )
    expect(setAppBadge).toHaveBeenLastCalledWith(2)
  })

  it("falls back to a generic notification for malformed payloads", async () => {
    store.set("count", "garbage")
    await dispatch("push", {
      data: {
        json: () => {
          throw new Error("bad json")
        },
      },
    })
    expect(showNotification).toHaveBeenCalledWith(
      "FantasyPhish",
      expect.any(Object)
    )
    expect(setAppBadge).toHaveBeenCalledWith(1)
  })

  it("focuses an open window on notification click, clearing the badge", async () => {
    const focus = vi.fn()
    matchAll.mockResolvedValue([
      { url: "https://x/other", focus: vi.fn() },
      { url: "https://x/pick/1", focus },
    ])
    const close = vi.fn()
    await dispatch("notificationclick", {
      notification: { close, data: { url: "/pick/1" } },
    })
    expect(close).toHaveBeenCalled()
    expect(clearAppBadge).toHaveBeenCalled()
    expect(focus).toHaveBeenCalled()
    expect(openWindow).not.toHaveBeenCalled()
  })

  it("opens a new window when none matches", async () => {
    matchAll.mockResolvedValue([])
    await dispatch("notificationclick", {
      notification: { close: vi.fn(), data: undefined },
    })
    expect(openWindow).toHaveBeenCalledWith("/")
  })

  it("clears the badge on request and ignores other messages", async () => {
    store.set("count", "3")
    await dispatch("message", { data: { type: "CLEAR_BADGE" } })
    expect(store.get("count")).toBe("0")
    expect(clearAppBadge).toHaveBeenCalled()
    handlers.message({ data: { type: "OTHER" }, waitUntil: vi.fn() })
    handlers.message({ data: null, waitUntil: vi.fn() })
  })
})
