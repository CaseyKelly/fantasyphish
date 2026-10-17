// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { render, screen, waitFor, act, fireEvent } from "@testing-library/react"
import userEvent from "@testing-library/user-event"

vi.mock("next-auth/react", () => ({
  useSession: vi.fn(),
  signOut: vi.fn(),
}))
vi.mock("next/navigation", () => ({
  usePathname: vi.fn(() => "/picks"),
  useRouter: vi.fn(),
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
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }))
vi.mock("@/lib/push-client", () => ({
  isPushSupported: vi.fn(() => false),
  isStandalonePwa: vi.fn(() => false),
  subscribeToPush: vi.fn(),
  unsubscribeFromPush: vi.fn(),
}))

import { useSession, signOut } from "next-auth/react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import {
  isPushSupported,
  isStandalonePwa,
  subscribeToPush,
  unsubscribeFromPush,
} from "@/lib/push-client"
import { Navbar } from "./Navbar"
import { ImpersonationBanner } from "./ImpersonationBanner"
import { InviteFriendsModal } from "./InviteFriendsModal"
import { NotificationSettings } from "./NotificationSettings"
import { FormatPoll } from "./FormatPoll"

const sessionMock = vi.mocked(useSession)
const fetchMock = vi.fn()
const refresh = vi.fn()
const originalLocation = window.location

function session(
  user: Record<string, unknown> = {},
  extra: Record<string, unknown> = {}
) {
  return {
    data: {
      user: {
        id: "u1",
        username: "alice",
        email: "a@x.com",
        isAdmin: false,
        isPrivateViewer: false,
        ...user,
      },
      expires: "",
      ...extra,
    },
    status: "authenticated",
    update: vi.fn(),
  } as never
}

function json(body: unknown, init: { ok?: boolean; status?: number } = {}) {
  return {
    ok: init.ok ?? true,
    status: init.status ?? 200,
    json: async () => body,
  }
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.stubGlobal("fetch", fetchMock)
  vi.mocked(useRouter).mockReturnValue({ refresh } as never)
  Object.defineProperty(window, "location", {
    configurable: true,
    value: { origin: "http://app.test", href: "", reload: vi.fn() },
  })
  vi.spyOn(console, "error").mockImplementation(() => {})
})

afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllGlobals()
  vi.unstubAllEnvs()
  Object.defineProperty(window, "location", {
    configurable: true,
    value: originalLocation,
  })
})

describe("Navbar", () => {
  it("shows login/signup when signed out", () => {
    sessionMock.mockReturnValue({ data: null } as never)
    render(<Navbar />)
    expect(screen.getByText("Log In")).toHaveAttribute("href", "/login")
    expect(screen.getByText("FantasyPhish").closest("a")).toHaveAttribute(
      "href",
      "/"
    )
    expect(screen.queryByText("My Picks")).not.toBeInTheDocument()
  })

  it("shows nav items, highlights the active page, and hides Admin for regular users", () => {
    sessionMock.mockReturnValue(session())
    render(<Navbar />)
    const active = screen.getAllByText("My Picks")[0].closest("a")!
    expect(active.className).toContain("text-[#d64545]")
    expect(screen.queryByText("Admin")).not.toBeInTheDocument()
    expect(screen.getAllByText("alice")).toHaveLength(2)
  })

  it.each([
    ["admins", session({ isAdmin: true })],
    ["private viewers", session({ isPrivateViewer: true })],
    [
      "impersonating admins",
      session({}, { impersonating: { originalIsAdmin: true } }),
    ],
  ])("shows Admin for %s", (_label, s) => {
    sessionMock.mockReturnValue(s)
    render(<Navbar />)
    expect(screen.getAllByText("Admin").length).toBeGreaterThan(0)
  })

  it("toggles the mobile menu and opens the invite modal from it", async () => {
    sessionMock.mockReturnValue(session())
    render(<Navbar />)
    const toggle = screen.getByRole("button", { name: "Open menu" })
    await userEvent.click(toggle)
    expect(toggle).toHaveAttribute("aria-expanded", "true")
    expect(toggle).toHaveAccessibleName("Close menu")

    // Second "Invite Friends" is the mobile one
    await userEvent.click(screen.getAllByText("Invite Friends")[1])
    expect(screen.getByRole("dialog")).toBeInTheDocument()
    expect(toggle).toHaveAttribute("aria-expanded", "false")
    await userEvent.click(screen.getByRole("button", { name: "Close" }))
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument()
  })

  it("closes the mobile menu on navigation and signs out", async () => {
    sessionMock.mockReturnValue(session())
    render(<Navbar />)
    await userEvent.click(screen.getByRole("button", { name: "Open menu" }))
    await userEvent.click(screen.getAllByText("Results")[1])
    const toggle = screen.getByRole("button", { name: "Open menu" })
    await userEvent.click(toggle)
    await userEvent.click(screen.getAllByText("alice")[1])
    expect(toggle).toHaveAttribute("aria-expanded", "false")
    await userEvent.click(screen.getAllByText("Sign Out")[0])
    await userEvent.click(screen.getAllByText("Sign Out")[1])
    expect(signOut).toHaveBeenCalledTimes(2)
    expect(signOut).toHaveBeenCalledWith({ callbackUrl: "/" })
    await userEvent.click(screen.getAllByText("Invite Friends")[0])
    expect(screen.getByRole("dialog")).toBeInTheDocument()
  })
})

describe("ImpersonationBanner", () => {
  it("renders nothing when not impersonating", () => {
    sessionMock.mockReturnValue(session())
    const { container } = render(<ImpersonationBanner />)
    expect(container).toBeEmptyDOMElement()
  })

  it("stops impersonating and reloads", async () => {
    const s = session({}, { impersonating: { originalUserId: "admin" } })
    sessionMock.mockReturnValue(s)
    fetchMock.mockResolvedValue(json({}))
    render(<ImpersonationBanner />)
    expect(screen.getByText("alice")).toBeInTheDocument()
    await userEvent.click(
      screen.getByRole("button", { name: /Stop Impersonating/ })
    )
    await waitFor(() => expect(window.location.reload).toHaveBeenCalled())
    expect(
      (s as { update: ReturnType<typeof vi.fn> }).update
    ).toHaveBeenCalledWith({
      stopImpersonating: true,
    })
  })

  it("shows an error toast when stopping fails", async () => {
    sessionMock.mockReturnValue(
      session({}, { impersonating: { originalUserId: "admin" } })
    )
    let resolve!: (v: unknown) => void
    fetchMock.mockReturnValue(new Promise((r) => (resolve = r)))
    render(<ImpersonationBanner />)
    await userEvent.click(
      screen.getByRole("button", { name: /Stop Impersonating/ })
    )
    expect(screen.getByText("Stopping...")).toBeInTheDocument()
    await act(async () => resolve(json({}, { ok: false })))
    await waitFor(() => expect(toast.error).toHaveBeenCalled())
    expect(screen.getByText("Stop Impersonating")).toBeInTheDocument()
  })
})

describe("InviteFriendsModal", () => {
  it("builds sms and mailto links from the app URL", async () => {
    vi.stubEnv("NEXT_PUBLIC_APP_URL", "https://fp.test")
    render(<InviteFriendsModal onClose={() => {}} />)
    await userEvent.click(screen.getByText("Text a Friend"))
    expect(window.location.href).toMatch(/^sms:\?body=.*fp\.test%2Fregister/)
    await userEvent.click(screen.getByText("Email a Friend"))
    expect(window.location.href).toMatch(/^mailto:\?subject=Join/)
    expect(screen.queryByText("More Sharing Options")).not.toBeInTheDocument()
  })

  it("copies the invite and resets the copied state", async () => {
    vi.stubEnv("NEXT_PUBLIC_APP_URL", "")
    const writeText = vi.fn(() => Promise.resolve())
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: { writeText },
    })
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] })
    const { unmount } = render(<InviteFriendsModal onClose={() => {}} />)
    await act(async () => {
      fireEvent.click(screen.getByText("Copy Invite Link"))
    })
    expect(writeText).toHaveBeenCalledWith(
      expect.stringContaining("http://app.test/register")
    )
    expect(screen.getByText("Copied!")).toBeInTheDocument()
    // Copying again restarts the reset timer
    await act(async () => {
      fireEvent.click(screen.getByText("Copied!"))
    })
    act(() => {
      vi.advanceTimersByTime(2000)
    })
    expect(screen.getByText("Copy Invite Link")).toBeInTheDocument()
    await act(async () => {
      fireEvent.click(screen.getByText("Copy Invite Link"))
    })
    unmount()
  })

  it("reports copy failures", async () => {
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: { writeText: vi.fn(() => Promise.reject(new Error("denied"))) },
    })
    render(<InviteFriendsModal onClose={() => {}} />)
    await userEvent.click(screen.getByText("Copy Invite Link"))
    expect(toast.error).toHaveBeenCalledWith("Couldn't copy the link")
  })

  it("uses the native share sheet when available, ignoring cancels", async () => {
    const share = vi
      .fn()
      .mockResolvedValueOnce(undefined)
      .mockRejectedValueOnce(new Error("cancel"))
    Object.defineProperty(navigator, "share", {
      configurable: true,
      value: share,
    })
    render(<InviteFriendsModal onClose={() => {}} />)
    await userEvent.click(screen.getByText("More Sharing Options"))
    await userEvent.click(screen.getByText("More Sharing Options"))
    expect(share).toHaveBeenCalledTimes(2)
    delete (navigator as unknown as Record<string, unknown>).share
  })
})

describe("NotificationSettings", () => {
  it("asks for verification before email reminders and install before push", () => {
    render(
      <NotificationSettings initialEmailEnabled={false} emailVerified={false} />
    )
    expect(screen.getByText(/Verify your email/)).toBeInTheDocument()
    expect(screen.getByText(/Install FantasyPhish/)).toBeInTheDocument()
  })

  it("toggles email reminders", async () => {
    fetchMock.mockResolvedValue(json({}))
    render(<NotificationSettings initialEmailEnabled={false} emailVerified />)
    const checkbox = screen.getByRole("checkbox")
    await userEvent.click(checkbox)
    await waitFor(() => expect(checkbox).toBeChecked())
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual({
      emailPickReminders: true,
    })
    expect(refresh).toHaveBeenCalled()

    await userEvent.click(checkbox)
    await waitFor(() => expect(checkbox).not.toBeChecked())
    expect(toast.success).toHaveBeenLastCalledWith(
      "Show-day email reminders turned off"
    )
  })

  it("reports email save failures", async () => {
    fetchMock.mockResolvedValue(json({}, { ok: false }))
    render(<NotificationSettings initialEmailEnabled emailVerified />)
    await userEvent.click(screen.getByRole("checkbox"))
    await waitFor(() => expect(toast.error).toHaveBeenCalled())
    expect(screen.getByRole("checkbox")).toBeChecked()
  })

  function enablePush(subscription: unknown) {
    vi.mocked(isPushSupported).mockReturnValue(true)
    vi.mocked(isStandalonePwa).mockReturnValue(true)
    Object.defineProperty(navigator, "serviceWorker", {
      configurable: true,
      value: {
        ready: Promise.resolve({
          pushManager: { getSubscription: () => Promise.resolve(subscription) },
        }),
      },
    })
  }

  it("toggles push on and off in an installed PWA", async () => {
    enablePush(null)
    render(<NotificationSettings initialEmailEnabled emailVerified={false} />)
    const toggle = await screen.findByRole("checkbox")
    expect(toggle).not.toBeChecked()

    await userEvent.click(toggle)
    await waitFor(() => expect(toggle).toBeChecked())
    expect(subscribeToPush).toHaveBeenCalled()

    await userEvent.click(toggle)
    await waitFor(() => expect(toggle).not.toBeChecked())
    expect(unsubscribeFromPush).toHaveBeenCalled()
  })

  it("reports push failures with the error message or a fallback", async () => {
    enablePush({})
    vi.mocked(unsubscribeFromPush)
      .mockRejectedValueOnce(new Error("Permission denied"))
      .mockRejectedValueOnce("weird")
    render(<NotificationSettings initialEmailEnabled emailVerified={false} />)
    const toggle = await screen.findByRole("checkbox")
    await waitFor(() => expect(toggle).toBeChecked())
    await userEvent.click(toggle)
    await waitFor(() =>
      expect(toast.error).toHaveBeenCalledWith("Permission denied")
    )
    await userEvent.click(toggle)
    await waitFor(() =>
      expect(toast.error).toHaveBeenCalledWith(
        "Couldn't update push notifications. Try again."
      )
    )
  })

  it("stays in the install prompt if the subscription lookup fails", async () => {
    vi.mocked(isPushSupported).mockReturnValue(true)
    vi.mocked(isStandalonePwa).mockReturnValue(true)
    Object.defineProperty(navigator, "serviceWorker", {
      configurable: true,
      value: { ready: Promise.reject(new Error("no sw")) },
    })
    render(<NotificationSettings initialEmailEnabled emailVerified={false} />)
    await act(async () => {})
    expect(screen.getByText(/Install FantasyPhish/)).toBeInTheDocument()
  })
})

describe("FormatPoll", () => {
  const poll = {
    slug: "p",
    question: "Add a pick?",
    description: "desc",
    options: [
      { id: "yes", label: "Yes" },
      { id: "no", label: "No" },
    ],
  }
  const results = {
    totalVotes: 1,
    options: [
      { id: "yes", label: "Yes", votes: 1, percent: 100 },
      { id: "no", label: "No", votes: 0, percent: 0 },
    ],
  }

  it("shows results immediately if the user already voted", async () => {
    fetchMock.mockResolvedValue(json({ userVote: "yes", results }))
    render(<FormatPoll poll={poll} />)
    expect(await screen.findByText("Your vote")).toBeInTheDocument()
    expect(screen.getByText(/1 vote so far/)).toBeInTheDocument()
    expect(
      screen.getByRole("progressbar", { name: "Yes: 100%" })
    ).toBeInTheDocument()
  })

  it("lets the user vote and then shows results", async () => {
    fetchMock
      .mockResolvedValueOnce(json({ userVote: null, results: null }))
      .mockResolvedValueOnce(
        json({ userVote: "no", results: { ...results, totalVotes: 2 } })
      )
    render(<FormatPoll poll={poll} />)
    const submit = await screen.findByRole("button", { name: "Submit Vote" })
    expect(submit).toBeDisabled()
    await userEvent.click(screen.getByLabelText("No"))
    await userEvent.click(submit)
    expect(await screen.findByText(/2 votes so far/)).toBeInTheDocument()
    expect(toast.success).toHaveBeenCalledWith("Thanks for voting!")
  })

  it("shows results without a toast on a 409, and errors otherwise", async () => {
    fetchMock
      .mockResolvedValueOnce(json(null, { ok: false }))
      .mockResolvedValueOnce(
        json({ error: "Nope" }, { ok: false, status: 400 })
      )
      .mockResolvedValueOnce(json({}, { ok: false, status: 500 }))
      .mockRejectedValueOnce(new Error("network"))
      .mockResolvedValueOnce(
        json({ userVote: "yes", results }, { ok: false, status: 409 })
      )
    render(<FormatPoll poll={poll} />)
    await userEvent.click(await screen.findByLabelText("Yes"))
    const submit = screen.getByRole("button", { name: "Submit Vote" })
    await userEvent.click(submit)
    await waitFor(() => expect(toast.error).toHaveBeenLastCalledWith("Nope"))
    await userEvent.click(submit)
    await waitFor(() =>
      expect(toast.error).toHaveBeenLastCalledWith("Failed to submit vote")
    )
    await userEvent.click(submit)
    await waitFor(() => expect(toast.error).toHaveBeenCalledTimes(3))
    await userEvent.click(submit)
    expect(await screen.findByText("Your vote")).toBeInTheDocument()
    expect(toast.success).not.toHaveBeenCalled()
  })

  it("logs initial load failures and still renders the form", async () => {
    fetchMock.mockRejectedValue(new Error("down"))
    render(<FormatPoll poll={poll} />)
    expect(
      await screen.findByRole("button", { name: "Submit Vote" })
    ).toBeInTheDocument()
  })
})
