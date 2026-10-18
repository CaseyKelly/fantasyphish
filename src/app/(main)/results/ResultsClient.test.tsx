// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { render, screen, fireEvent, act } from "@testing-library/react"

vi.mock("next/navigation", () => ({
  useRouter: vi.fn(),
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
vi.mock("@/lib/auth", () => ({ auth: vi.fn() }))
vi.mock("@/lib/prisma", async () => {
  const { createPrismaMock } = await import("@/test-utils/prisma-mock")
  return { prisma: createPrismaMock() }
})

import { useRouter } from "next/navigation"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { resetPrismaMock, type PrismaMock } from "@/test-utils/prisma-mock"
import ResultsClient from "./ResultsClient"
import ResultsPage from "./page"

const db = prisma as unknown as PrismaMock
const refresh = vi.fn()
const fetchMock = vi.fn()
const originalLocation = window.location

function pick(
  id: string,
  name: string,
  pickType: string,
  wasPlayed: boolean | null,
  // A played opener/encore defaults to a slot hit (3); pass 1 for one
  // played elsewhere in the show
  pointsEarned = wasPlayed ? (pickType === "REGULAR" ? 1 : 3) : 0
) {
  return {
    id,
    pickType,
    song: {
      id,
      name,
      slug: id,
      artist: "Phish",
      timesPlayed: 0,
      gap: null,
      lastPlayed: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    wasPlayed,
    pointsEarned,
  }
}

function submission(
  id: string,
  overrides: Record<string, unknown> = {},
  show: Record<string, unknown> = {}
) {
  return {
    id,
    totalPoints: 5,
    isScored: true,
    show: {
      id: `show-${id}`,
      venue: "MSG",
      city: "New York",
      state: "NY",
      country: "USA",
      showDate: new Date("2025-07-04T00:00:00Z"),
      isComplete: true,
      tour: null,
      ...show,
    },
    picks: [
      pick("o", "Tweezer", "OPENER", true),
      pick("e", "Harpua", "ENCORE", false),
      pick("x", "Ghost", "ENCORE", null),
      pick("o2", "Carini", "OPENER", true, 1),
      pick("r1", "Fee", "REGULAR", true),
      pick("r2", "Slave", "REGULAR", false),
      pick("r3", "Bowie", "REGULAR", null),
    ],
    ...overrides,
  }
}

const stats = {
  totalSubmissions: 2,
  scoredSubmissions: 2,
  totalPoints: 12,
  avgPoints: 6,
  correctPicks: 4,
  totalPicks: 26,
  accuracy: 15,
}

beforeEach(() => {
  vi.clearAllMocks()
  resetPrismaMock(db)
  vi.mocked(useRouter).mockReturnValue({ refresh } as never)
  vi.stubGlobal("fetch", fetchMock)
  vi.stubGlobal(
    "confirm",
    vi.fn(() => true)
  )
  Object.defineProperty(window, "location", {
    configurable: true,
    value: { reload: vi.fn() },
  })
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

describe("ResultsClient (results list)", () => {
  it("shows stats and an empty state", () => {
    render(
      <ResultsClient
        submissions={[]}
        stats={{ ...stats, totalPoints: 0 }}
        isAdmin={false}
      />
    )
    expect(screen.getByText("15%")).toBeInTheDocument()
    expect(screen.getByText(/haven't made any picks yet/)).toBeInTheDocument()
  })

  it("renders scored, live, and pending submissions", () => {
    render(
      <ResultsClient
        submissions={
          [
            submission("a"),
            submission(
              "b",
              { isScored: false },
              { isComplete: false, venue: "Test Venue 1", state: null }
            ),
            submission(
              "c",
              { totalPoints: null },
              { showDate: "2025-07-06T00:00:00.000Z" }
            ),
            submission("d", {}, { showDate: "not-a-date" }),
            submission("e", {}, { showDate: new Date("invalid") }),
          ] as never
        }
        stats={stats}
        isAdmin={false}
      />
    )
    expect(screen.getAllByText("MSG").length).toBe(4)
    expect(screen.getByText("Test")).toBeInTheDocument()
    expect(screen.getByText("LIVE")).toBeInTheDocument()
    expect(screen.getByText("Awaiting results")).toBeInTheDocument()
    expect(screen.getByText(/New York, USA/)).toBeInTheDocument()
    expect(screen.getAllByText("Jul 4, 2025").length).toBeGreaterThan(0)
    expect(screen.getByText("Jul 6, 2025")).toBeInTheDocument()
    expect(screen.getAllByText("Invalid date")).toHaveLength(2)
    expect(screen.getAllByText("+3").length).toBeGreaterThan(0)
    // An opener played outside its slot shows the regular point it earned
    expect(screen.getAllByText("+1").length).toBeGreaterThan(0)
    expect(screen.getAllByText("View Details")[0]).toHaveAttribute(
      "href",
      "/results_detail/show-a"
    )
    expect(screen.queryByText("Delete")).toBeNull()
  })

  it("refreshes every minute while a show is in progress", () => {
    vi.useFakeTimers({ toFake: ["setInterval", "clearInterval"] })
    render(
      <ResultsClient
        submissions={[submission("a", {}, { isComplete: false })] as never}
        stats={stats}
        isAdmin={false}
      />
    )
    vi.advanceTimersByTime(60_000)
    expect(refresh).toHaveBeenCalledTimes(1)
  })

  it("lets admins delete a submission after confirming, reloading either way", async () => {
    fetchMock
      .mockResolvedValueOnce({ ok: true, json: async () => ({}) })
      .mockResolvedValueOnce({
        ok: false,
        json: async () => ({ error: "nope" }),
      })
      .mockResolvedValueOnce({ ok: false, json: async () => ({}) })
    render(
      <ResultsClient
        submissions={[submission("a")] as never}
        stats={stats}
        isAdmin
      />
    )
    const del = () =>
      act(async () => {
        fireEvent.click(screen.getByRole("button", { name: /Delete/ }))
      })
    await del()
    expect(fetchMock).toHaveBeenCalledWith("/api/admin/delete-submission/a", {
      method: "DELETE",
    })
    await del()
    await del()
    expect(window.location.reload).toHaveBeenCalledTimes(3)

    vi.mocked(confirm).mockReturnValue(false)
    await del()
    expect(fetchMock).toHaveBeenCalledTimes(3)
  })
})

describe("results page", () => {
  it("redirects signed-out users", async () => {
    vi.mocked(auth).mockResolvedValue(null as never)
    await expect(ResultsPage()).rejects.toThrow("REDIRECT:/login")
  })

  it("computes stats from scored or locked submissions", async () => {
    vi.mocked(auth).mockResolvedValue({
      user: { id: "u1", isAdmin: true },
    } as never)
    const past = new Date(Date.now() - 60_000)
    const future = new Date(Date.now() + 60_000)
    db.submission.findMany.mockResolvedValue([
      {
        isScored: true,
        totalPoints: 6,
        show: { lockTime: null },
        picks: [{ wasPlayed: true }, { wasPlayed: false }],
      },
      {
        isScored: false,
        totalPoints: null,
        show: { lockTime: past },
        picks: [{ wasPlayed: true }],
      },
      {
        isScored: false,
        totalPoints: 9,
        show: { lockTime: future },
        picks: [],
      },
    ])
    const element = await ResultsPage()
    expect(element.props.isAdmin).toBe(true)
    expect(element.props.stats).toEqual({
      totalSubmissions: 3,
      scoredSubmissions: 2,
      totalPoints: 6,
      avgPoints: 3,
      correctPicks: 2,
      totalPicks: 26,
      accuracy: 8,
    })
  })

  it("returns zeroed stats with no submissions", async () => {
    vi.mocked(auth).mockResolvedValue({ user: { id: "u1" } } as never)
    db.submission.findMany.mockResolvedValue([])
    const element = await ResultsPage()
    expect(element.props.stats.avgPoints).toBe(0)
    expect(element.props.stats.accuracy).toBe(0)
    expect(element.props.isAdmin).toBe(false)
  })
})
