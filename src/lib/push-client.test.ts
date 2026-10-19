import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import {
  isPushSupported,
  isStandalonePwa,
  subscribeToPush,
  unsubscribeFromPush,
} from "./push-client"

const fetchMock = vi.fn()
const subscribe = vi.fn()
const getSubscription = vi.fn()
const requestPermission = vi.fn()

function stubBrowser(
  opts: { standalone?: boolean; displayStandalone?: boolean } = {}
) {
  const navigator = {
    serviceWorker: {
      ready: Promise.resolve({ pushManager: { subscribe, getSubscription } }),
    },
    standalone: opts.standalone,
  }
  vi.stubGlobal("navigator", navigator)
  vi.stubGlobal("window", {
    PushManager: function PushManager() {},
    navigator,
    matchMedia: () => ({ matches: opts.displayStandalone ?? false }),
  })
  vi.stubGlobal("Notification", { requestPermission })
  vi.stubGlobal("fetch", fetchMock)
}

beforeEach(() => {
  fetchMock.mockReset()
  subscribe.mockReset()
  getSubscription.mockReset()
  requestPermission.mockReset()
})

afterEach(() => {
  vi.unstubAllGlobals()
  vi.unstubAllEnvs()
})

describe("feature detection", () => {
  it("reports unsupported on the server", () => {
    vi.stubGlobal("window", undefined)
    expect(isPushSupported()).toBe(false)
    expect(isStandalonePwa()).toBe(false)
  })

  it("detects push support in a browser", () => {
    stubBrowser()
    expect(isPushSupported()).toBe(true)
  })

  it("detects standalone mode via display-mode or iOS navigator.standalone", () => {
    stubBrowser({ displayStandalone: true })
    expect(isStandalonePwa()).toBe(true)
    stubBrowser({ standalone: true })
    expect(isStandalonePwa()).toBe(true)
    stubBrowser()
    expect(isStandalonePwa()).toBe(false)
  })
})

describe("subscribeToPush", () => {
  it("throws when the public key isn't configured", async () => {
    stubBrowser()
    vi.stubEnv("NEXT_PUBLIC_VAPID_PUBLIC_KEY", "")
    await expect(subscribeToPush()).rejects.toThrow("not configured")
  })

  it("throws when permission is denied", async () => {
    stubBrowser()
    vi.stubEnv("NEXT_PUBLIC_VAPID_PUBLIC_KEY", "AQAB")
    requestPermission.mockResolvedValue("denied")
    await expect(subscribeToPush()).rejects.toThrow("not granted")
  })

  it("subscribes with the decoded key and saves the subscription", async () => {
    stubBrowser()
    vi.stubEnv("NEXT_PUBLIC_VAPID_PUBLIC_KEY", "AQ-_")
    requestPermission.mockResolvedValue("granted")
    subscribe.mockResolvedValue({ toJSON: () => ({ endpoint: "e" }) })
    fetchMock.mockResolvedValue({ ok: true })

    await subscribeToPush()

    const { applicationServerKey } = subscribe.mock.calls[0][0]
    expect(Array.from(applicationServerKey as Uint8Array)).toEqual([1, 15, 191])
    expect(fetchMock).toHaveBeenCalledWith("/api/push/subscribe", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ endpoint: "e" }),
    })
  })

  it("surfaces the server's error, or a default message", async () => {
    stubBrowser()
    vi.stubEnv("NEXT_PUBLIC_VAPID_PUBLIC_KEY", "AQAB")
    requestPermission.mockResolvedValue("granted")
    subscribe.mockResolvedValue({ toJSON: () => ({}) })

    fetchMock.mockResolvedValueOnce({
      ok: false,
      json: async () => ({ error: "Unauthorized" }),
    })
    await expect(subscribeToPush()).rejects.toThrow("Unauthorized")

    fetchMock.mockResolvedValueOnce({
      ok: false,
      json: async () => {
        throw new Error("not json")
      },
    })
    await expect(subscribeToPush()).rejects.toThrow(
      "Failed to save push subscription"
    )
  })
})

describe("unsubscribeFromPush", () => {
  it("unsubscribes and deletes the server record", async () => {
    stubBrowser()
    const unsubscribe = vi.fn()
    getSubscription.mockResolvedValue({ endpoint: "e1", unsubscribe })
    await unsubscribeFromPush()
    expect(unsubscribe).toHaveBeenCalled()
    expect(fetchMock).toHaveBeenCalledWith("/api/push/subscribe", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ endpoint: "e1" }),
    })
  })

  it("does nothing when not subscribed", async () => {
    stubBrowser()
    getSubscription.mockResolvedValue(null)
    await unsubscribeFromPush()
    expect(fetchMock).not.toHaveBeenCalled()
  })
})
