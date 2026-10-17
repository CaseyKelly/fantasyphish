// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { render, screen, fireEvent, act } from "@testing-library/react"
import { renderToStaticMarkup } from "react-dom/server"

vi.mock("next/navigation", () => ({
  redirect: vi.fn((url: string) => {
    throw new Error(`REDIRECT:${url}`)
  }),
}))
vi.mock("next/link", () => ({
  default: ({
    href,
    children,
    ...rest
  }: React.AnchorHTMLAttributes<HTMLAnchorElement> & { href: string }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}))
vi.mock("next/font/google", () => ({
  Inter: () => ({ variable: "font-inter" }),
  Righteous: () => ({ variable: "font-righteous" }),
}))
vi.mock("@vercel/analytics/next", () => ({ Analytics: () => null }))
vi.mock("@vercel/speed-insights/next", () => ({ SpeedInsights: () => null }))
vi.mock("@/components/Providers", () => ({
  Providers: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}))
vi.mock("@sentry/nextjs", () => ({ captureException: vi.fn() }))
vi.mock("@/lib/auth", () => ({ auth: vi.fn() }))
vi.mock("@/components/SongPicker", () => ({
  SongPicker: (props: {
    isLocked: boolean
    onGuestSubmit: (p: unknown[]) => void
  }) => (
    <div>
      <span>picker locked={String(props.isLocked)}</span>
      <button
        onClick={() =>
          props.onGuestSubmit([
            { songId: "s", songName: "Tweezer", pickType: "OPENER" },
          ])
        }
      >
        guest submit
      </button>
    </div>
  ),
}))
vi.mock("@/components/GuestRegistrationModal", () => ({
  GuestRegistrationModal: ({ onClose }: { onClose: () => void }) => (
    <div role="dialog">
      <button onClick={onClose}>close modal</button>
    </div>
  ),
}))

import * as Sentry from "@sentry/nextjs"
import { auth } from "@/lib/auth"
import { HomeClient } from "./HomeClient"
import LandingPage from "./page"
import GlobalError from "./global-error"
import RootLayout, { metadata, viewport } from "./layout"

const fetchMock = vi.fn()

function json(body: unknown) {
  return { ok: true, json: async () => body }
}

function respond(nextShow: unknown, songs: unknown[] = [{ id: "s" }]) {
  fetchMock.mockImplementation(async (url: string) =>
    url.includes("/api/shows") ? json({ nextShow }) : json({ songs })
  )
}

const show = (overrides: Record<string, unknown> = {}) => ({
  id: "show-1",
  venue: "MSG",
  city: "New York",
  state: "NY",
  country: "USA",
  showDate: "2030-07-04T00:00:00.000Z",
  isComplete: false,
  lockTime: "2030-07-04T23:00:00.000Z",
  timezone: "America/New_York",
  tour: { id: "t", name: "Summer Tour", startDate: "", endDate: null },
  ...overrides,
})

async function renderHome() {
  render(<HomeClient />)
  await act(async () => {})
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.stubGlobal("fetch", fetchMock)
  vi.spyOn(console, "error").mockImplementation(() => {})
})

afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

describe("landing page", () => {
  it("redirects signed-in users to their picks", async () => {
    vi.mocked(auth).mockResolvedValue({ user: { id: "u1" } } as never)
    await expect(LandingPage()).rejects.toThrow("REDIRECT:/picks")
  })

  it("renders the marketing page for guests", async () => {
    vi.mocked(auth).mockResolvedValue(null as never)
    fetchMock.mockReturnValue(new Promise(() => {}))
    render(await LandingPage())
    expect(screen.getByText(/You Knew/)).toBeInTheDocument()
    expect(screen.getByText("17 pts")).toBeInTheDocument()
  })
})

describe("HomeClient", () => {
  it("shows the next show with venue and local lock times", async () => {
    vi.spyOn(Intl.DateTimeFormat.prototype, "resolvedOptions").mockReturnValue({
      timeZone: "America/Los_Angeles",
    } as Intl.ResolvedDateTimeFormatOptions)
    respond(show())
    await renderHome()
    expect(screen.getByText("Make Your Picks")).toBeInTheDocument()
    expect(screen.getByText("Summer Tour")).toBeInTheDocument()
    expect(
      screen.getByText("MSG • New York, NY • July 4, 2030")
    ).toBeInTheDocument()
    expect(
      screen.getByText("Picks lock at 7 PM ET (4 PM PT) on Jul 4")
    ).toBeInTheDocument()
    expect(screen.getByText("picker locked=false")).toBeInTheDocument()
  })

  it("shows only venue time when the viewer is in the venue timezone", async () => {
    vi.spyOn(Intl.DateTimeFormat.prototype, "resolvedOptions").mockReturnValue({
      timeZone: "America/New_York",
    } as Intl.ResolvedDateTimeFormatOptions)
    respond(show({ tour: null, state: "" }))
    await renderHome()
    expect(
      screen.getByText("Picks lock at 7 PM ET on Jul 4")
    ).toBeInTheDocument()
    expect(
      screen.getByText("MSG • New York • July 4, 2030")
    ).toBeInTheDocument()
  })

  it("falls back to venue time and reports an unusable browser timezone", async () => {
    vi.spyOn(Intl.DateTimeFormat.prototype, "resolvedOptions").mockReturnValue({
      timeZone: "Etc/Unknown",
    } as Intl.ResolvedDateTimeFormatOptions)
    respond(show())
    await renderHome()
    expect(
      screen.getByText("Picks lock at 7 PM ET on Jul 4")
    ).toBeInTheDocument()
    expect(Sentry.captureException).toHaveBeenCalled()
  })

  it("formats the lock time locally when the show has no timezone", async () => {
    respond(show({ timezone: null }))
    await renderHome()
    expect(
      screen.getByText(/Picks lock at \d{1,2}:\d{2} [AP]M on Jul \d, 2030/)
    ).toBeInTheDocument()
  })

  it("shows a live badge once locked and hides the lock time", async () => {
    respond(show({ lockTime: "2020-01-01T00:00:00.000Z" }))
    await renderHome()
    expect(screen.getByText("Show In Progress")).toBeInTheDocument()
    expect(screen.getByText("LIVE")).toBeInTheDocument()
    expect(screen.queryByText(/Picks lock at/)).toBeNull()
    expect(screen.getByText("picker locked=true")).toBeInTheDocument()
  })

  it("opens and closes the guest registration modal", async () => {
    respond(show({ lockTime: null }))
    await renderHome()
    fireEvent.click(screen.getByText("guest submit"))
    expect(screen.getByRole("dialog")).toBeInTheDocument()
    fireEvent.click(screen.getByText("close modal"))
    expect(screen.queryByRole("dialog")).toBeNull()
  })

  it("renders no picker without a show or songs, or on fetch errors", async () => {
    respond(null)
    await renderHome()
    expect(screen.queryByText(/picker/)).toBeNull()

    respond(show(), [])
    await renderHome()
    expect(screen.queryByText(/picker/)).toBeNull()

    fetchMock.mockReset()
    fetchMock.mockImplementation(async (url: string) =>
      url.includes("/api/shows") ? json({ nextShow: show() }) : json({})
    )
    await renderHome()
    fetchMock.mockRejectedValue(new Error("offline"))
    await renderHome()
    expect(console.error).toHaveBeenCalledWith(
      "Error fetching data:",
      expect.any(Error)
    )
  })
})

describe("error boundary", () => {
  // Module-level retry state persists across renders, so load fresh per test
  async function loadError() {
    vi.resetModules()
    return (await import("./error")).default
  }

  it("shows a deterministic excuse, reports the error, and retries on demand", async () => {
    const ErrorPage = await loadError()
    const retry = vi.fn()
    const error = Object.assign(new Error("boom"), { digest: "abc" })
    render(<ErrorPage error={error} retry={retry} />)
    expect(screen.getByText("Well, That Was Unexpected")).toBeInTheDocument()
    const { captureException } = await import("@sentry/nextjs")
    expect(captureException).toHaveBeenCalledWith(error)
    fireEvent.click(screen.getByRole("button", { name: /Try Again/ }))
    expect(retry).toHaveBeenCalledTimes(1)
  })

  it("uses the message, or nothing, to pick an excuse", async () => {
    const ErrorPage = await loadError()
    const { unmount } = render(
      <ErrorPage error={new Error("x")} retry={vi.fn()} />
    )
    unmount()
    render(<ErrorPage error={new Error("")} retry={vi.fn()} />)
    expect(screen.getByText("Back to Home")).toBeInTheDocument()
  })

  it("silently retries a transient network error once, then honors a cooldown", async () => {
    vi.useFakeTimers({ toFake: ["Date"] })
    try {
      const ErrorPage = await loadError()
      const retry = vi.fn()
      const first = render(
        <ErrorPage error={new TypeError("Failed to fetch")} retry={retry} />
      )
      expect(retry).toHaveBeenCalledTimes(1)
      expect(first.container).toBeEmptyDOMElement()
      // A second failure while that retry is in flight shows the page
      first.rerender(
        <ErrorPage error={new TypeError("Failed to fetch")} retry={retry} />
      )
      expect(screen.getByText("Well, That Was Unexpected")).toBeInTheDocument()
      expect(retry).toHaveBeenCalledTimes(1)
      // Unmounting means the boundary recovered; the cooldown starts now
      first.unmount()

      const cooling = render(
        <ErrorPage error={new TypeError("Load failed")} retry={retry} />
      )
      expect(screen.getByText("Well, That Was Unexpected")).toBeInTheDocument()
      expect(retry).toHaveBeenCalledTimes(1)
      cooling.unmount()

      vi.advanceTimersByTime(31_000)
      const later = render(
        <ErrorPage error={new TypeError("Load failed")} retry={retry} />
      )
      expect(retry).toHaveBeenCalledTimes(2)
      expect(later.container).toBeEmptyDOMElement()
      later.unmount()
    } finally {
      vi.useRealTimers()
    }
  })
})

describe("global error", () => {
  it("reports the error and offers a reset", () => {
    const reset = vi.fn()
    const error = new Error("root broke")
    render(<GlobalError error={error} reset={reset} />)
    expect(Sentry.captureException).toHaveBeenCalledWith(error)
    fireEvent.click(screen.getByRole("button", { name: "Try Again" }))
    expect(reset).toHaveBeenCalled()
  })
})

describe("root layout", () => {
  it("renders fonts, JSON-LD, and children", () => {
    const html = renderToStaticMarkup(
      <RootLayout>
        <p>hello</p>
      </RootLayout>
    )
    expect(html).toContain("font-inter font-righteous")
    expect(html).toContain('"@type":"WebApplication"')
    expect(html).toContain("http://localhost:3000")
    expect(html).toContain("<p>hello</p>")
    expect(metadata.manifest).toBe("/manifest.json")
    expect(viewport.themeColor).toBe("#2d4654")
  })

  it("uses the configured app URL", () => {
    vi.stubEnv("NEXT_PUBLIC_APP_URL", "https://fp.test")
    expect(renderToStaticMarkup(<RootLayout>x</RootLayout>)).toContain(
      "https://fp.test"
    )
    vi.unstubAllEnvs()
  })
})
