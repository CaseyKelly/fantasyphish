// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen, fireEvent, within } from "@testing-library/react"

vi.mock("next/navigation", () => ({ useRouter: vi.fn() }))
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
vi.mock("@/lib/leaderboard", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/leaderboard")>()),
  getLeaderboard: vi.fn(),
  getCurrentOrLastShow: vi.fn(),
}))

import { useRouter } from "next/navigation"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { getLeaderboard, getCurrentOrLastShow } from "@/lib/leaderboard"
import { resetPrismaMock, type PrismaMock } from "@/test-utils/prisma-mock"
import LeaderboardClient from "./LeaderboardClient"
import LeaderboardPage from "./page"

const db = prisma as unknown as PrismaMock
const refresh = vi.fn()

type Entry = Parameters<typeof LeaderboardClient>[0]["tourLeaderboard"][number]

function showPicks(id: string, day: number, points: number) {
  return {
    show: {
      id,
      showDate: new Date(`2025-07-${String(day).padStart(2, "0")}T00:00:00Z`),
      venue: `Venue ${day}`,
      city: day % 2 ? "Denver" : null,
      state: day % 2 ? "CO" : null,
      setCount: 1,
    },
    totalPoints: points,
    picks: [
      {
        songName: "Tweezer",
        wasPlayed: true,
        pointsEarned: 3,
        pickType: "OPENER",
        openerSet: 1,
      },
      {
        songName: "Fee",
        wasPlayed: true,
        pointsEarned: 1,
        pickType: "REGULAR",
        openerSet: null,
      },
      {
        songName: "Ghost",
        wasPlayed: false,
        pointsEarned: 0,
        pickType: "REGULAR",
        openerSet: null,
      },
      {
        songName: "Harpua",
        wasPlayed: false,
        pointsEarned: 0,
        pickType: "ENCORE",
        openerSet: null,
      },
      {
        songName: "Slave",
        wasPlayed: true,
        pointsEarned: 3,
        pickType: "ENCORE",
        openerSet: null,
      },
    ],
  }
}

function entry(
  userId: string,
  rank: number,
  totalPoints: number,
  extra: Partial<Entry> = {}
): Entry {
  return {
    userId,
    username: userId,
    totalPoints,
    showsPlayed: 2,
    avgPoints: totalPoints / 2,
    accuracy: 50,
    rank,
    showStreak: null,
    picksByShow: [showPicks(`${userId}-s1`, 4, totalPoints)],
    ...extra,
  }
}

const tour = (
  status: "ACTIVE" | "COMPLETED" | "CLOSED" | "FUTURE",
  endDate: Date | null = new Date("2025-08-01T00:00:00Z")
) => ({
  name: "Summer Tour",
  startDate: new Date("2025-07-01T00:00:00Z"),
  endDate,
  status,
})

const nextShow = (status: Parameters<typeof tour>[0] = "ACTIVE") => ({
  venue: "MSG",
  city: "New York",
  state: "NY",
  showDate: new Date("2025-07-10T00:00:00Z"),
  tour: tour(status),
})

const baseProps = {
  tourLeaderboard: [] as Entry[],
  showLeaderboard: [] as Entry[],
  currentShow: null,
  currentShowSetlist: null,
  nextShow: null,
  currentUserId: null,
  hasPastTours: false,
}

beforeEach(() => {
  vi.clearAllMocks()
  resetPrismaMock(db)
  vi.mocked(useRouter).mockReturnValue({ refresh } as never)
})

describe("LeaderboardClient — tour view", () => {
  it("shows an empty state with no tour", () => {
    render(<LeaderboardClient {...baseProps} />)
    expect(screen.getByText("No scores yet for this tour.")).toBeInTheDocument()
    expect(screen.queryByText("This Show")).toBeNull()
    expect(screen.queryByText("View Past Tour Winners")).toBeNull()
  })

  it("shows the upcoming tour, standings, your rank, and the history link", () => {
    render(
      <LeaderboardClient
        {...baseProps}
        nextShow={nextShow("FUTURE")}
        tourLeaderboard={[
          entry("alice", 1, 20, { showStreak: 4 }),
          entry("bob", 2, 15),
          entry("carol", 3, 10),
          entry("dave", 4, 5),
        ]}
        currentUserId="bob"
        hasPastTours
      />
    )
    expect(screen.getByText("Summer Tour")).toBeInTheDocument()
    expect(screen.getByText("Jul 1, 2025 - Aug 1, 2025")).toBeInTheDocument()
    expect(
      screen.getByText(/Next: MSG, New York, NY • Jul 10/)
    ).toBeInTheDocument()
    // Not finished, so no podium
    expect(
      screen.queryByRole("region", { name: "Leaderboard podium" })
    ).toBeNull()
    expect(screen.getByText("Your Rank")).toBeInTheDocument()
    expect(screen.getByText("#2")).toBeInTheDocument()
    expect(screen.getByText("2 shows played")).toBeInTheDocument()
    expect(screen.getByText("(You)")).toBeInTheDocument()
    expect(screen.getByLabelText("4-show streak")).toBeInTheDocument()
    expect(screen.getByText("View Past Tour Winners")).toHaveAttribute(
      "href",
      "/leaderboard/history"
    )
    expect(
      screen.getByText("Points are cumulative per tour")
    ).toBeInTheDocument()
  })

  it("shows a final podium for finished tours, grouping ties", () => {
    render(
      <LeaderboardClient
        {...baseProps}
        nextShow={{ ...nextShow("COMPLETED"), tour: tour("COMPLETED", null) }}
        tourLeaderboard={[
          entry("alice", 1, 20),
          entry("bob", 2, 15),
          entry("carol", 2, 15),
          entry("dave", 4, 5),
        ]}
      />
    )
    expect(
      screen.getByText("Tour Complete - Final Results")
    ).toBeInTheDocument()
    expect(screen.getByText("Jul 1, 2025")).toBeInTheDocument()
    const podium = screen.getByRole("region", { name: "Leaderboard podium" })
    expect(
      within(podium).getByLabelText("1st place: alice")
    ).toBeInTheDocument()
    expect(
      within(podium).getByLabelText("Tied for 2nd place: bob")
    ).toBeInTheDocument()
    expect(
      within(podium).getByLabelText("Tied for 2nd place: carol")
    ).toBeInTheDocument()
    expect(within(podium).getByText("Tie")).toBeInTheDocument()
    // Only 1st and 2nd filled: rank order, not 2-1-3
    const places = within(podium)
      .getAllByText(/^(1st|2nd|3rd)$/)
      .map((e) => e.textContent)
    expect(places).toEqual(["1st", "2nd"])
  })

  it("uses the 2-1-3 arrangement when all three spots are filled", () => {
    render(
      <LeaderboardClient
        {...baseProps}
        nextShow={nextShow("CLOSED")}
        tourLeaderboard={[
          entry("alice", 1, 20),
          entry("bob", 2, 15),
          entry("carol", 3, 10),
        ]}
      />
    )
    const podium = screen.getByRole("region", { name: "Leaderboard podium" })
    const places = within(podium)
      .getAllByText(/^(1st|2nd|3rd)$/)
      .map((e) => e.textContent)
    expect(places).toEqual(["2nd", "1st", "3rd"])
  })

  it("expands a row to show picks per show, collapsing long histories", () => {
    const many = [5, 4, 3, 2, 1].map((d) => showPicks(`s${d}`, d, d))
    render(
      <LeaderboardClient
        {...baseProps}
        nextShow={nextShow("FUTURE")}
        tourLeaderboard={[
          entry("alice", 1, 20, { picksByShow: many }),
          entry("bob", 2, 1, { picksByShow: [showPicks("b1", 7, 1)] }),
          entry("carol", 3, 0, { picksByShow: [] }),
        ]}
      />
    )
    const [aliceRow, bobRow] = screen.getAllByRole("button", {
      expanded: false,
    })
    fireEvent.click(aliceRow)
    expect(aliceRow).toHaveAttribute("aria-expanded", "true")
    expect(screen.getByText("Show 2 earlier shows")).toBeInTheDocument()
    fireEvent.click(screen.getByText("Show 2 earlier shows"))
    expect(screen.getByText("Show fewer shows")).toBeInTheDocument()
    expect(screen.getAllByText("Tweezer").length).toBeGreaterThan(5)
    // Keyboard toggles too, and collapses
    fireEvent.keyDown(aliceRow, { key: "Enter" })
    expect(aliceRow).toHaveAttribute("aria-expanded", "false")
    fireEvent.keyDown(bobRow, { key: " " })
    expect(bobRow).toHaveAttribute("aria-expanded", "true")
    expect(screen.getAllByText("1 pt").length).toBeGreaterThan(0)
    fireEvent.keyDown(bobRow, { key: "x" })
    // Clicking the username link doesn't toggle the row
    fireEvent.click(screen.getByRole("link", { name: "bob" }))
    expect(bobRow).toHaveAttribute("aria-expanded", "true")
  })

  it("doesn't collapse a history that's only one show longer than the limit", () => {
    render(
      <LeaderboardClient
        {...baseProps}
        tourLeaderboard={[
          entry("alice", 1, 20, {
            picksByShow: [4, 3, 2, 1].map((d) => showPicks(`s${d}`, d, d)),
          }),
        ]}
      />
    )
    expect(screen.queryByText(/earlier show/)).toBeNull()
  })
})

describe("LeaderboardClient — this show view", () => {
  const liveShow = {
    showDate: new Date("2025-07-04T00:00:00Z"),
    venue: "MSG",
    city: "New York",
    state: "NY",
    isComplete: false,
  }

  it("defaults to the show view during an active tour and refreshes on return", () => {
    render(
      <LeaderboardClient
        {...baseProps}
        nextShow={nextShow()}
        currentShow={liveShow}
      />
    )
    expect(screen.getByText("MSG, New York, NY")).toBeInTheDocument()
    expect(screen.getByText("Jul 4, 2025")).toBeInTheDocument()
    expect(screen.getByText("Live Scoring")).toBeInTheDocument()
    expect(screen.getByText("Waiting for the first song")).toBeInTheDocument()
    expect(
      screen.getByText("No picks were submitted for this show.")
    ).toBeInTheDocument()
    expect(
      screen.getByText("Points shown are for this show only")
    ).toBeInTheDocument()
    window.dispatchEvent(new Event("focus"))
    expect(refresh).toHaveBeenCalled()

    fireEvent.click(screen.getByRole("button", { name: "Tour Standings" }))
    expect(
      screen.getByText("Points are cumulative per tour")
    ).toBeInTheDocument()
    fireEvent.click(screen.getByRole("button", { name: "This Show" }))
    expect(
      screen.getByText("Points shown are for this show only")
    ).toBeInTheDocument()
  })

  it("tells you when no show has locked yet", () => {
    render(<LeaderboardClient {...baseProps} nextShow={nextShow()} />)
    expect(screen.getByText(/No show has locked yet/)).toBeInTheDocument()
  })

  it("shows the podium, your correct picks, and an expandable setlist", () => {
    render(
      <LeaderboardClient
        {...baseProps}
        nextShow={nextShow()}
        currentShow={{ ...liveShow, isComplete: true }}
        currentShowSetlist={{
          setlistNotes: "Great show",
          songs: [
            { song: "Tweezer", set: "1", position: 1, footnote: "" },
            { song: "Fee", set: "2", position: 2, footnote: "" },
            { song: "Slave", set: "e", position: 3, footnote: "" },
            { song: "Coda", set: "e2", position: 4, footnote: "" },
          ],
        }}
        showLeaderboard={[
          entry("alice", 1, 7),
          entry("bob", 2, 4),
          entry("carol", 3, 1),
        ]}
        currentUserId="alice"
      />
    )
    expect(screen.getByText("Final Results")).toBeInTheDocument()
    expect(
      screen.getByRole("region", { name: "Leaderboard podium" })
    ).toBeInTheDocument()
    expect(screen.getByText("3 of 13 picks correct")).toBeInTheDocument()
    // In "Your Rank" and in the collapsed per-show detail
    expect(screen.getAllByText("7 pts").length).toBeGreaterThan(0)

    const toggle = screen.getByRole("button", { name: /Setlist/ })
    fireEvent.click(toggle)
    expect(toggle).toHaveAttribute("aria-expanded", "true")
    expect(screen.getByText("Great show")).toBeInTheDocument()
    expect(screen.getByText("Set 1")).toBeInTheDocument()
    // Set headings (pick-detail rows also have "Encore" labels)
    expect(screen.getByRole("heading", { name: "Encore" })).toBeInTheDocument()
    expect(
      screen.getByRole("heading", { name: "Encore 2" })
    ).toBeInTheDocument()
    fireEvent.click(toggle)
  })

  it("skips the podium with fewer than 3 scorers and the waiting card once complete", () => {
    render(
      <LeaderboardClient
        {...baseProps}
        nextShow={nextShow()}
        currentShow={{ ...liveShow, isComplete: true }}
        currentShowSetlist={{ setlistNotes: "", songs: [] }}
        showLeaderboard={[entry("alice", 1, 0, { picksByShow: [] })]}
        currentUserId="alice"
      />
    )
    expect(
      screen.queryByRole("region", { name: "Leaderboard podium" })
    ).toBeNull()
    expect(screen.queryByText("Waiting for the first song")).toBeNull()
    expect(screen.queryByRole("button", { name: /Setlist/ })).toBeNull()
    expect(screen.getByText("0 of 13 picks correct")).toBeInTheDocument()
  })
})

describe("leaderboard page", () => {
  const params = (tourId?: string) => ({
    searchParams: Promise.resolve(tourId ? { tourId } : {}),
  })

  beforeEach(() => {
    vi.mocked(auth).mockResolvedValue({ user: { id: "u1" } } as never)
    vi.mocked(getLeaderboard).mockResolvedValue([])
    vi.mocked(getCurrentOrLastShow).mockResolvedValue(null)
    db.tour.count.mockResolvedValue(0)
  })

  it.each([
    ["completed", [{ id: "t-done", shows: [{ id: "s" }] }]],
    ["active", [null, { id: "t-active", shows: [{ id: "s" }] }]],
    [
      "finished-but-active",
      [null, null, { id: "t-fin", shows: [{ id: "s" }] }],
    ],
    ["upcoming", [null, null, null, { id: "t-up", shows: [{ id: "s" }] }]],
  ])("picks the %s tour", async (_label, tours) => {
    for (const t of tours) db.tour.findFirst.mockResolvedValueOnce(t)
    const expectedId = (tours[tours.length - 1] as { id: string }).id
    const element = await LeaderboardPage(params())
    expect(getCurrentOrLastShow).toHaveBeenCalledWith(expectedId)
    expect(element.props.nextShow.tour.id).toBe(expectedId)
    expect(element.props.currentUserId).toBe("u1")
  })

  it("prefers an explicit tourId and falls back to the next show", async () => {
    db.show.findFirst.mockResolvedValue({
      id: "next",
      tourId: "t-next",
      tour: null,
    })
    db.tour.findFirst.mockResolvedValue(null)
    db.tour.count.mockResolvedValue(2)
    vi.mocked(auth).mockResolvedValue(null as never)

    const element = await LeaderboardPage(params())
    expect(getCurrentOrLastShow).toHaveBeenLastCalledWith("t-next")
    expect(element.props.nextShow.id).toBe("next")
    expect(element.props.hasPastTours).toBe(true)
    expect(element.props.currentUserId).toBeNull()

    await LeaderboardPage(params("t-manual"))
    expect(getCurrentOrLastShow).toHaveBeenLastCalledWith("t-manual")
  })

  it("passes the current show and its cleaned setlist", async () => {
    db.tour.findFirst.mockResolvedValue({ id: "t", shows: [] })
    db.show.findFirst.mockResolvedValue(null)
    vi.mocked(getCurrentOrLastShow).mockResolvedValue({
      id: "show-1",
      showDate: new Date("2025-07-04T00:00:00Z"),
      venue: "MSG",
      city: "NYC",
      state: "NY",
      isComplete: true,
      setlistJson: {
        setlistnotes: "<p>Notes &amp; more</p>",
        songs: [
          { song: "Tweezer", set: "1", position: 1, footnote: "<i>tease</i>" },
        ],
      },
    })
    const element = await LeaderboardPage(params())
    expect(element.props.currentShowSetlist).toEqual({
      setlistNotes: "Notes & more",
      songs: [{ song: "Tweezer", set: "1", position: 1, footnote: "tease" }],
    })
    expect(element.props.currentShow.venue).toBe("MSG")
    expect(getLeaderboard).toHaveBeenCalledTimes(2)
    // Tour has no shows, so the display falls back to the next show (none)
    expect(element.props.nextShow).toBeNull()
  })

  it("omits the setlist when the current show has none", async () => {
    db.tour.findFirst.mockResolvedValue(null)
    vi.mocked(getCurrentOrLastShow).mockResolvedValue({
      id: "show-1",
      setlistJson: null,
    } as never)
    expect(
      (await LeaderboardPage(params())).props.currentShowSetlist
    ).toBeNull()
  })
})
