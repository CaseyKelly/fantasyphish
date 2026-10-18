// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { render, screen, fireEvent, act, within } from "@testing-library/react"

vi.mock("next/navigation", () => ({
  useRouter: vi.fn(),
  redirect: vi.fn((url: string) => {
    throw new Error(`REDIRECT:${url}`)
  }),
  notFound: vi.fn(() => {
    throw new Error("NOT_FOUND")
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
vi.mock("next-auth/react", () => ({ useSession: vi.fn() }))
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }))
vi.mock("@/lib/auth", () => ({ auth: vi.fn() }))
vi.mock("@/lib/prisma", async () => {
  const { createPrismaMock } = await import("@/test-utils/prisma-mock")
  return { prisma: createPrismaMock() }
})
vi.mock("@/lib/admin-usage", () => ({
  getUsageOverview: vi.fn(),
  getUserEngagementRows: vi.fn(),
  getShowParticipation: vi.fn(),
  getAchievementDistribution: vi.fn(),
  getDonutLeaderboard: vi.fn(),
  getStreakLeaderboard: vi.fn(),
}))

import { useRouter } from "next/navigation"
import { useSession } from "next-auth/react"
import { toast } from "sonner"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import * as usage from "@/lib/admin-usage"
import { resetPrismaMock, type PrismaMock } from "@/test-utils/prisma-mock"
import AdminHubPage from "./page"
import AdminCompleteShowsPage from "./complete-shows/page"
import CompleteShowsClient from "./complete-shows/CompleteShowsClient"
import AdminImpersonatePage from "./impersonate/page"
import ImpersonateClient from "./impersonate/ImpersonateClient"
import AdminShowsPage from "./shows/page"
import { ShowLockOverrideForm } from "./shows/ShowLockOverrideForm"
import AdminUsagePage from "./usage/page"
import { UsageOverview } from "./usage/UsageOverview"
import { UsageTables } from "./usage/UsageTables"

const db = prisma as unknown as PrismaMock
const authMock = vi.mocked(auth)
const refresh = vi.fn()
const fetchMock = vi.fn()
const originalLocation = window.location

const admin = {
  user: { id: "a1", isAdmin: true, isPrivateViewer: false },
} as never
const regular = {
  user: { id: "u1", isAdmin: false, isPrivateViewer: false },
} as never

function json(body: unknown, ok = true) {
  return { ok, json: async () => body }
}

beforeEach(() => {
  vi.clearAllMocks()
  resetPrismaMock(db)
  vi.mocked(useRouter).mockReturnValue({ refresh } as never)
  vi.mocked(useSession).mockReturnValue({ update: vi.fn() } as never)
  vi.stubGlobal("fetch", fetchMock)
  vi.stubGlobal(
    "confirm",
    vi.fn(() => true)
  )
  vi.spyOn(console, "error").mockImplementation(() => {})
})

afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllGlobals()
  Object.defineProperty(window, "location", {
    configurable: true,
    value: originalLocation,
  })
})

describe("admin page guards", () => {
  const pages: [string, () => Promise<unknown>][] = [
    ["complete-shows", AdminCompleteShowsPage],
    ["impersonate", AdminImpersonatePage],
    ["shows", AdminShowsPage],
    ["usage", AdminUsagePage],
  ]

  it.each(pages)(
    "%s redirects anonymous users and 404s non-admins",
    async (_name, page) => {
      authMock.mockResolvedValueOnce(null as never)
      await expect(page()).rejects.toThrow("REDIRECT:/login")
      authMock.mockResolvedValueOnce(regular)
      await expect(page()).rejects.toThrow("NOT_FOUND")
    }
  )

  it("hub redirects anonymous users and 404s regular users", async () => {
    authMock.mockResolvedValueOnce(null as never)
    await expect(AdminHubPage()).rejects.toThrow("REDIRECT:/login")
    authMock.mockResolvedValueOnce(regular)
    await expect(AdminHubPage()).rejects.toThrow("NOT_FOUND")
  })

  it("hub lists admin tools, and only Submissions for the private viewer", async () => {
    authMock.mockResolvedValueOnce(admin)
    const { unmount } = render(await AdminHubPage())
    expect(screen.getByText("Feature Usage")).toBeInTheDocument()
    expect(screen.getByText("Impersonate User")).toBeInTheDocument()
    expect(screen.queryByText("Submissions")).toBeNull()
    unmount()

    authMock.mockResolvedValueOnce({
      user: { id: "p1", isAdmin: false, isPrivateViewer: true },
    } as never)
    render(await AdminHubPage())
    expect(screen.getByText("Submissions").closest("a")).toHaveAttribute(
      "href",
      "/submissions"
    )
    expect(screen.queryByText("Feature Usage")).toBeNull()
  })

  it("lets an impersonating admin in", async () => {
    authMock.mockResolvedValueOnce({
      user: { id: "u1", isAdmin: false },
      impersonating: { originalIsAdmin: true },
    } as never)
    render(await AdminImpersonatePage())
    expect(
      screen.getByRole("heading", { name: "Impersonate User" })
    ).toBeInTheDocument()
  })
})

describe("complete shows", () => {
  const row = (overrides: Record<string, unknown> = {}) => ({
    id: "s1",
    venue: "MSG",
    city: "New York",
    state: "NY",
    showDate: "2025-07-04T00:00:00.000Z",
    hasSetlist: true,
    encoreStartedAt: null,
    submissionCount: 1,
    ...overrides,
  })

  it("server page maps shows into rows", async () => {
    authMock.mockResolvedValue(admin)
    db.show.findMany.mockResolvedValue([
      {
        id: "s1",
        venue: "MSG",
        city: "New York",
        state: "NY",
        showDate: new Date("2025-07-04T00:00:00Z"),
        setlistJson: {},
        encoreStartedAt: new Date("2025-07-05T03:00:00Z"),
        _count: { submissions: 2 },
      },
      {
        id: "s2",
        venue: "Dicks",
        city: null,
        state: null,
        showDate: new Date("2025-08-30T00:00:00Z"),
        setlistJson: null,
        encoreStartedAt: null,
        _count: { submissions: 0 },
      },
    ])
    render(await AdminCompleteShowsPage())
    expect(screen.getByText("MSG • New York, NY")).toBeInTheDocument()
    expect(screen.getByText("July 4, 2025 • 2 submissions")).toBeInTheDocument()
    expect(screen.getByText("Not started")).toBeInTheDocument()
    expect(
      screen.getByText("August 30, 2025 • 0 submissions")
    ).toBeInTheDocument()
  })

  it("shows grace-period status and ticks every second", () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date("2025-07-05T03:30:00Z"))
    render(
      <CompleteShowsClient
        initialShows={[
          row({ id: "a", venue: "Live" }),
          row({
            id: "b",
            venue: "Encore",
            encoreStartedAt: "2025-07-05T03:00:00Z",
          }),
          row({
            id: "c",
            venue: "Done",
            encoreStartedAt: "2025-07-05T02:00:00Z",
          }),
        ]}
      />
    )
    expect(screen.getByText("In progress")).toBeInTheDocument()
    expect(
      screen.getByText("Encore detected — 30m 0s left")
    ).toBeInTheDocument()
    expect(screen.getByText("Finalizing…")).toBeInTheDocument()
    act(() => {
      vi.advanceTimersByTime(1000)
    })
    expect(
      screen.getByText("Encore detected — 29m 59s left")
    ).toBeInTheDocument()
  })

  it("marks a show complete after confirming", async () => {
    fetchMock.mockResolvedValue(json({ success: true }))
    render(<CompleteShowsClient initialShows={[row()]} />)
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /Mark Complete/ }))
    })
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual({
      showId: "s1",
    })
    expect(toast.success).toHaveBeenCalledWith("MSG marked complete")
    expect(refresh).toHaveBeenCalled()
    expect(
      screen.getByText(/No shows are currently in progress/)
    ).toBeInTheDocument()
  })

  it("skips when not confirmed and reports failures", async () => {
    render(<CompleteShowsClient initialShows={[row()]} />)
    const click = () =>
      act(async () => {
        fireEvent.click(screen.getByRole("button", { name: /Mark Complete/ }))
      })
    vi.mocked(confirm).mockReturnValueOnce(false)
    await click()
    expect(fetchMock).not.toHaveBeenCalled()

    fetchMock
      .mockResolvedValueOnce(
        json({ error: "No setlist data available yet" }, false)
      )
      .mockResolvedValueOnce(json({}, false))
      .mockRejectedValueOnce("weird")
    await click()
    expect(toast.error).toHaveBeenLastCalledWith(
      "No setlist data available yet"
    )
    await click()
    expect(toast.error).toHaveBeenLastCalledWith("Failed to complete show")
    await click()
    expect(toast.error).toHaveBeenLastCalledWith("Failed to complete show")
  })
})

describe("impersonate", () => {
  const update = vi.fn()
  beforeEach(() => {
    vi.mocked(useSession).mockReturnValue({ update } as never)
    Object.defineProperty(window, "location", {
      configurable: true,
      value: { href: "" },
    })
  })

  it("lists users and impersonates one, then reloads to /picks", async () => {
    fetchMock
      .mockResolvedValueOnce(
        json({
          users: [
            { id: "u2", username: "bob", email: "b@x.com", isAdmin: true },
            { id: "u3", username: "carol", email: "c@x.com", isAdmin: false },
          ],
        })
      )
      .mockResolvedValueOnce(
        json({
          impersonation: {
            originalUserId: "a1",
            originalUsername: "root",
            originalIsAdmin: true,
            targetUser: {
              id: "u3",
              username: "carol",
              email: "c@x.com",
              isAdmin: false,
            },
          },
        })
      )
    render(<ImpersonateClient />)
    expect(screen.getByRole("status")).toHaveTextContent("Loading users…")
    expect(await screen.findByText("(Admin)")).toBeInTheDocument()
    await act(async () => {
      fireEvent.click(screen.getByText("carol"))
    })
    expect(update).toHaveBeenCalledWith({
      impersonating: expect.objectContaining({
        targetUserId: "u3",
        originalUserId: "a1",
      }),
    })
    expect(window.location.href).toBe("/picks")
  })

  it("handles empty, failed, and thrown user loads", async () => {
    fetchMock.mockResolvedValueOnce(json({}, false))
    const { unmount } = render(<ImpersonateClient />)
    expect(await screen.findByText("No users found")).toBeInTheDocument()
    unmount()
    fetchMock.mockRejectedValueOnce(new Error("offline"))
    render(<ImpersonateClient />)
    expect(await screen.findByText("No users found")).toBeInTheDocument()
  })

  it("shows an error when impersonation fails", async () => {
    fetchMock
      .mockResolvedValueOnce(
        json({
          users: [
            { id: "u2", username: "bob", email: "b@x.com", isAdmin: false },
          ],
        })
      )
      .mockResolvedValueOnce(json({}, false))
    render(<ImpersonateClient />)
    const bob = await screen.findByText("bob")
    await act(async () => {
      fireEvent.click(bob)
    })
    expect(toast.error).toHaveBeenCalled()
    expect(screen.getByText("bob").closest("button")).toBeEnabled()
  })
})

describe("show lock overrides", () => {
  const show = {
    id: "s1",
    showDate: "2025-07-04T00:00:00.000Z",
    venue: "MSG",
    city: "New York",
    state: "NY",
    timezone: "America/New_York",
    lockTime: "2025-07-04T23:00:00.000Z",
    lockTimeOverride: null as string | null,
  }

  it("server page lists upcoming shows with a timezone fallback", async () => {
    authMock.mockResolvedValue(admin)
    db.show.findMany.mockResolvedValueOnce([])
    const { unmount } = render(await AdminShowsPage())
    expect(screen.getByText("No upcoming shows.")).toBeInTheDocument()
    unmount()

    db.show.findMany.mockResolvedValueOnce([
      {
        id: "s1",
        showDate: new Date("2025-07-04T00:00:00Z"),
        venue: "Red Rocks",
        city: null,
        state: "CO",
        timezone: null,
        lockTime: null,
        lockTimeOverride: null,
        setCount: 2,
        submissions: [],
      },
      {
        id: "s2",
        showDate: new Date("2025-07-05T00:00:00Z"),
        venue: "MSG",
        city: "New York",
        state: "NY",
        timezone: "America/New_York",
        lockTime: new Date("2025-07-05T23:00:00Z"),
        lockTimeOverride: new Date("2025-07-05T23:00:00Z"),
        setCount: 2,
        // Picked as a one-set show before it was raised to two sets
        submissions: [
          {
            picks: [
              { pickType: "OPENER", openerSet: 1 },
              { pickType: "ENCORE", openerSet: null },
              ...Array.from({ length: 11 }, () => ({
                pickType: "REGULAR",
                openerSet: null,
              })),
            ],
          },
        ],
      },
    ])
    render(await AdminShowsPage())
    expect(screen.getByText(/No lock time set/)).toBeInTheDocument()
    expect(screen.getByText(/1 submission needs updating/)).toBeInTheDocument()
    expect(screen.getByLabelText("Lock time (MT)")).toHaveValue("19:00")
    expect(screen.getByText("(manual override)")).toBeInTheDocument()
  })

  it("saves a new lock time in the venue timezone", async () => {
    fetchMock.mockResolvedValue(
      json({ show: { lockTime: "2025-07-05T00:30:00.000Z" } })
    )
    render(<ShowLockOverrideForm show={show} />)
    expect(screen.getByText(/Locks at 7:00 PM ET/)).toBeInTheDocument()
    expect(screen.queryByRole("button", { name: "Clear" })).toBeNull()
    fireEvent.change(screen.getByLabelText("Lock time (ET)"), {
      target: { value: "20:30" },
    })
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Save" }))
    })
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual({
      showId: "s1",
      lockTime: "2025-07-05T00:30:00.000Z",
    })
    expect(screen.getByLabelText("Lock time (ET)")).toHaveValue("20:30")
    expect(refresh).toHaveBeenCalled()
  })

  it("clears an override", async () => {
    fetchMock.mockResolvedValue(
      json({ show: { lockTime: "2025-07-04T23:00:00.000Z" } })
    )
    render(
      <ShowLockOverrideForm
        show={{ ...show, lockTimeOverride: show.lockTime }}
      />
    )
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Clear" }))
    })
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual({
      showId: "s1",
      lockTime: null,
    })
    expect(refresh).toHaveBeenCalled()
  })

  it("keeps the input when the response has no lock time", async () => {
    fetchMock.mockResolvedValue(json({ show: { lockTime: null } }))
    render(
      <ShowLockOverrideForm
        show={{ ...show, lockTimeOverride: show.lockTime }}
      />
    )
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Save" }))
    })
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Clear" }))
    })
    expect(screen.getByLabelText("Lock time (ET)")).toHaveValue("19:00")
  })

  it.each([
    ["Save", json({ error: "Show not found" }, false), "Show not found"],
    ["Save", json({}, false), "Failed to set lock time"],
    ["Clear", json({ error: "Nope" }, false), "Nope"],
    ["Clear", json({}, false), "Failed to clear lock time override"],
  ])("%s shows errors", async (button, response, message) => {
    fetchMock.mockResolvedValue(response)
    render(
      <ShowLockOverrideForm
        show={{ ...show, lockTimeOverride: show.lockTime }}
      />
    )
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: button }))
    })
    expect(screen.getByText(message)).toBeInTheDocument()
  })

  it.each(["Save", "Clear"])(
    "%s reports non-Error failures",
    async (button) => {
      fetchMock.mockRejectedValue("weird")
      render(
        <ShowLockOverrideForm
          show={{ ...show, lockTimeOverride: show.lockTime }}
        />
      )
      await act(async () => {
        fireEvent.click(screen.getByRole("button", { name: button }))
      })
      expect(
        screen.getByText(
          button === "Save"
            ? "Failed to set lock time"
            : "Failed to clear lock time override"
        )
      ).toBeInTheDocument()
    }
  )
})

describe("usage", () => {
  const overview = {
    totalUsers: 3,
    verifiedUsers: 2,
    emailOptInUsers: 1,
    emailOptInPct: 33,
    pushEnabledUsers: 1,
    pushEnabledPct: 33,
    donutPlayers: 1,
    donutPlayersPct: 33,
    totalSubmissions: 5,
  }
  const userRow = (id: string, overrides: Record<string, unknown> = {}) => ({
    id,
    username: id,
    email: `${id}@x.com`,
    signupDate: "2025-01-01T00:00:00.000Z",
    emailVerified: true,
    isAdmin: false,
    emailOptIn: false,
    pushCount: 0,
    submissionCount: 1,
    lastSubmissionDate: null,
    donutScore: null,
    achievementCount: 0,
    ...overrides,
  })
  const engagementRows = [
    userRow("alice", {
      emailOptIn: true,
      isAdmin: true,
      lastSubmissionDate: "2025-07-04T00:00:00.000Z",
    }),
    userRow("bob", { pushCount: 2, donutScore: 30 }),
    userRow("carol", { emailVerified: false }),
  ]

  it("server page loads every dataset", async () => {
    authMock.mockResolvedValue(admin)
    vi.mocked(usage.getUsageOverview).mockResolvedValue(overview)
    vi.mocked(usage.getUserEngagementRows).mockResolvedValue(
      engagementRows as never
    )
    vi.mocked(usage.getShowParticipation).mockResolvedValue([])
    vi.mocked(usage.getAchievementDistribution).mockResolvedValue([])
    vi.mocked(usage.getDonutLeaderboard).mockResolvedValue([])
    vi.mocked(usage.getStreakLeaderboard).mockResolvedValue([])
    render(await AdminUsagePage())
    expect(
      screen.getByRole("heading", { name: "Feature Usage" })
    ).toBeInTheDocument()
    expect(screen.getAllByText("1 (33%)")).toHaveLength(3)
  })

  it.each([
    ["Total Users", "Total Users", 3],
    ["Verified", "Verified Users", 2],
    ["Total Submissions", "Submissions by User", 3],
    ["Donut Players", "Donut Catch Players", 1],
    ["Email Reminders On", "Email Reminders On", 1],
    ["Push Enabled", "Push Notifications On", 1],
  ])("the %s tile opens a filtered user list", (tile, title, count) => {
    render(
      <UsageOverview
        overview={overview}
        engagementRows={engagementRows as never}
      />
    )
    fireEvent.click(
      screen.getByText(tile, { selector: "p" }).closest("button")!
    )
    const dialog = screen.getByRole("dialog")
    expect(
      within(dialog).getByRole("heading", { name: title })
    ).toBeInTheDocument()
    expect(
      within(dialog).getByText(`${count} user${count === 1 ? "" : "s"}`)
    ).toBeInTheDocument()
  })

  it("closes via the button, the backdrop, or Escape but not inner clicks", () => {
    render(
      <UsageOverview
        overview={overview}
        engagementRows={engagementRows as never}
      />
    )
    const open = () =>
      fireEvent.click(
        screen.getByText("Total Users", { selector: "p" }).closest("button")!
      )
    open()
    fireEvent.click(screen.getByRole("dialog"))
    expect(screen.getByRole("dialog")).toBeInTheDocument()
    fireEvent.click(screen.getByRole("button", { name: "Close" }))
    expect(screen.queryByRole("dialog")).toBeNull()
    open()
    fireEvent.click(screen.getByRole("dialog").parentElement!)
    expect(screen.queryByRole("dialog")).toBeNull()
    open()
    fireEvent.keyDown(document, { key: "Escape" })
    expect(screen.queryByRole("dialog")).toBeNull()
    // Submissions list renders "—" for users without a last submission
    fireEvent.click(
      screen
        .getByText("Total Submissions", { selector: "p" })
        .closest("button")!
    )
    expect(
      within(screen.getByRole("dialog")).getByText("2025-07-04")
    ).toBeInTheDocument()
  })

  it("renders tables, searches users, and collapses sections", () => {
    render(
      <UsageTables
        engagementRows={engagementRows as never}
        showRows={[
          {
            id: "s1",
            showDate: "2025-07-04T00:00:00.000Z",
            venue: "MSG",
            tourName: null,
            isComplete: true,
            submissionCount: 2,
            participationPct: 67,
          },
        ]}
        achievementRows={[
          {
            id: "a",
            slug: "a",
            name: "Jackpot",
            category: "PICKS",
            icon: "🐈",
            earnedCount: 1,
          },
        ]}
        donutRows={[
          {
            userId: "bob",
            username: "bob",
            score: 30,
            achievedAt: "2025-07-01T00:00:00.000Z",
          },
        ]}
        streakRows={[
          {
            userId: "alice",
            username: "alice",
            currentStreak: 3,
            bestStreak: 5,
          },
        ]}
      />
    )
    expect(screen.getByText("67%")).toBeInTheDocument()
    expect(screen.getByText("🐈")).toBeInTheDocument()
    expect(screen.getByText("2025-07-01")).toBeInTheDocument()

    const search = screen.getByRole("searchbox", { name: "Search users" })
    fireEvent.change(search, { target: { value: "BOB@" } })
    expect(screen.getAllByText("bob").length).toBeGreaterThan(0)
    expect(screen.queryByText("carol")).toBeNull()
    fireEvent.change(search, { target: { value: "zzz" } })
    expect(screen.getByText("No users match your search.")).toBeInTheDocument()

    const header = screen.getByRole("button", { name: /Show Participation/ })
    fireEvent.click(header)
    expect(header).toHaveAttribute("aria-expanded", "false")
    fireEvent.keyDown(header, { key: "Enter" })
    expect(header).toHaveAttribute("aria-expanded", "true")
    fireEvent.keyDown(header, { key: " " })
    expect(header).toHaveAttribute("aria-expanded", "false")
    fireEvent.keyDown(header, { key: "a" })
    expect(header).toHaveAttribute("aria-expanded", "false")
  })

  it("shows the no-users message without a search", () => {
    render(
      <UsageTables
        engagementRows={[]}
        showRows={[]}
        achievementRows={[]}
        donutRows={[]}
        streakRows={[]}
      />
    )
    expect(screen.getByText("No users yet.")).toBeInTheDocument()
  })
})
