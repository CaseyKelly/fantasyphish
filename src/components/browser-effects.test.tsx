// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { cleanup, render } from "@testing-library/react"

vi.mock("next/navigation", () => ({ usePathname: vi.fn(() => "/a") }))

import { usePathname } from "next/navigation"
import { ClearAppBadge } from "./ClearAppBadge"
import { ServiceWorkerUpdater } from "./ServiceWorkerUpdater"
import { ScrollToTop } from "./ScrollToTop"
import { LocalDateTime } from "./LocalDateTime"

const originalLocation = window.location

function stubServiceWorker(controller: unknown = null) {
  const listeners: Record<string, () => void> = {}
  const update = vi.fn()
  const postMessage = vi.fn()
  const sw = {
    controller,
    ready: Promise.resolve({ active: { postMessage } }),
    getRegistration: vi.fn(() => Promise.resolve({ update })),
    addEventListener: vi.fn((type: string, fn: () => void) => {
      listeners[type] = fn
    }),
    removeEventListener: vi.fn(),
  }
  Object.defineProperty(navigator, "serviceWorker", {
    configurable: true,
    value: sw,
  })
  return { sw, listeners, update, postMessage }
}

function removeServiceWorker() {
  // jsdom has no serviceWorker; make sure a stub from another test is gone
  delete (navigator as unknown as Record<string, unknown>).serviceWorker
}

beforeEach(() => {
  Object.defineProperty(window, "location", {
    configurable: true,
    value: { ...originalLocation, reload: vi.fn() },
  })
})

afterEach(() => {
  // Unmount before removing the stubs the effects clean up against
  cleanup()
  removeServiceWorker()
  Object.defineProperty(window, "location", {
    configurable: true,
    value: originalLocation,
  })
  delete (navigator as unknown as Record<string, unknown>).clearAppBadge
})

const flush = () => new Promise((r) => setTimeout(r, 0))

describe("ClearAppBadge", () => {
  it("does nothing without service worker support", () => {
    removeServiceWorker()
    expect(() => render(<ClearAppBadge />)).not.toThrow()
  })

  it("clears the badge on mount, focus, and becoming visible", async () => {
    const { postMessage } = stubServiceWorker()
    const clearAppBadge = vi.fn(() => Promise.resolve())
    Object.defineProperty(navigator, "clearAppBadge", {
      configurable: true,
      value: clearAppBadge,
    })
    const { unmount } = render(<ClearAppBadge />)
    window.dispatchEvent(new Event("focus"))
    document.dispatchEvent(new Event("visibilitychange"))
    await flush()
    expect(clearAppBadge).toHaveBeenCalledTimes(3)
    expect(postMessage).toHaveBeenCalledWith({ type: "CLEAR_BADGE" })
    unmount()
  })

  it("ignores a rejected badge clear", async () => {
    stubServiceWorker()
    Object.defineProperty(navigator, "clearAppBadge", {
      configurable: true,
      value: vi.fn(() => Promise.reject(new Error("no"))),
    })
    render(<ClearAppBadge />)
    await flush()
  })
})

describe("ServiceWorkerUpdater", () => {
  it("does nothing without service worker support", () => {
    expect(() => render(<ServiceWorkerUpdater />)).not.toThrow()
  })

  it("checks for updates on mount, focus, and visibility", async () => {
    const { update } = stubServiceWorker({})
    const { unmount } = render(<ServiceWorkerUpdater />)
    window.dispatchEvent(new Event("focus"))
    document.dispatchEvent(new Event("visibilitychange"))
    await flush()
    expect(update).toHaveBeenCalledTimes(3)
    unmount()
  })

  it("skips the first controller takeover, then reloads once on replacement", () => {
    const { listeners } = stubServiceWorker(null)
    render(<ServiceWorkerUpdater />)
    listeners.controllerchange()
    expect(window.location.reload).not.toHaveBeenCalled()
    listeners.controllerchange()
    listeners.controllerchange()
    expect(window.location.reload).toHaveBeenCalledTimes(1)
  })

  it("reloads immediately when the page was already controlled", () => {
    const { listeners } = stubServiceWorker({})
    render(<ServiceWorkerUpdater />)
    listeners.controllerchange()
    expect(window.location.reload).toHaveBeenCalledTimes(1)
  })
})

describe("ScrollToTop", () => {
  it("scrolls to the top on each pathname change", () => {
    const scrollTo = vi.fn()
    window.scrollTo = scrollTo as typeof window.scrollTo
    const { rerender } = render(<ScrollToTop />)
    vi.mocked(usePathname).mockReturnValue("/b")
    rerender(<ScrollToTop />)
    expect(scrollTo).toHaveBeenCalledTimes(2)
    expect(scrollTo).toHaveBeenCalledWith(0, 0)
  })
})

describe("LocalDateTime", () => {
  it("formats the timestamp in the browser's timezone", () => {
    const { container } = render(
      <LocalDateTime iso="2025-07-04T23:00:00Z" className="x" />
    )
    const span = container.querySelector("span.x")
    expect(span?.textContent).toMatch(/Jul 4|Jul 5/)
  })
})
