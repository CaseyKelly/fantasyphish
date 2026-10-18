// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { render, screen, fireEvent, act } from "@testing-library/react"

vi.mock("next/navigation", () => ({ useRouter: vi.fn() }))
vi.mock("@/lib/auth", () => ({ auth: vi.fn() }))
vi.mock("@/lib/prisma", async () => {
  const { createPrismaMock } = await import("@/test-utils/prisma-mock")
  return { prisma: createPrismaMock() }
})

import { useRouter } from "next/navigation"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { resetPrismaMock, type PrismaMock } from "@/test-utils/prisma-mock"
import { routeParams } from "@/test-utils/request"
import ResultsClient from "./ResultsClient"
import ResultsPage, { generateMetadata } from "./page"

const db = prisma as unknown as PrismaMock
const push = vi.fn()
const fetchMock = vi.fn()

function pick(
  id: string,
  song: string,
  pickType: string,
  wasPlayed: boolean | null,
  pointsEarned = 0,
  openerSet: number | null = null
) {
  return { id, song, pickType, wasPlayed, pointsEarned, openerSet }
}

function results(overrides: Record<string, unknown> = {}) {
  return {
    show: {
      id: "show-1",
      venue: "MSG",
      city: "New York",
      state: "NY",
      showDate: "2025-07-04T00:00:00.000Z",
      isComplete: true,
      lockTime: null,
      lastScoredAt: null,
      setCount: 2,
    },
    submission: {
      id: "sub-1",
      totalPoints: 7,
      isScored: true,
      username: "bob",
      picks: [
        pick("p1", "Tweezer", "OPENER", true, 3, 1),
        pick("p2", "Harpua", "ENCORE", false),
        pick("p3", "Fee", "REGULAR", true, 1),
        pick("p4", "Mike's Song", "REGULAR", null),
        // Set 2 opener pick played later in set 2: regular points only
        pick("p5", "Ghost", "OPENER", true, 1, 2),
      ],
    },
    setlist: {
      setlistNotes: "Fee debut",
      songs: [
        { song: "Tweezer", set: "1", position: 1, footnote: "" },
        { song: "Fee", set: "1", position: 2, footnote: "With a tease" },
        { song: "Mike's Song", set: "2", position: 3, footnote: "" },
        { song: "Ghost", set: "2", position: 4, footnote: "" },
        { song: "Tweezer", set: "e", position: 5, footnote: "" },
        { song: "Harpua", set: "e", position: 6, footnote: "" },
      ],
    },
    ...overrides,
  }
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
  resetPrismaMock(db)
  vi.mocked(useRouter).mockReturnValue({ push } as never)
  vi.stubGlobal("fetch", fetchMock)
  vi.spyOn(console, "error").mockImplementation(() => {})
})

afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllGlobals()
})

async function renderLoaded(isAdmin = false) {
  render(<ResultsClient showId="show-1" isAdmin={isAdmin} />)
  await act(async () => {})
}

describe("ResultsClient", () => {
  it("shows a loading state, then the final results", async () => {
    let resolve!: (v: unknown) => void
    fetchMock.mockReturnValue(new Promise((r) => (resolve = r)))
    render(<ResultsClient showId="show-1" isAdmin={false} />)
    expect(screen.getByRole("status")).toHaveTextContent("Loading results…")
    await act(async () => resolve(json(results())))

    expect(
      screen.getByText(/MSG • New York, NY • July 4, 2025/)
    ).toBeInTheDocument()
    expect(screen.getByText("Final Score")).toBeInTheDocument()
    expect(screen.getByText("7")).toBeInTheDocument()
    expect(screen.getByText("Your Picks")).toBeInTheDocument()
    expect(screen.queryByText("Delete Submission")).toBeNull()
  })

  it("labels setlist songs by pick type, only on their first appearance", async () => {
    fetchMock.mockResolvedValue(json(results()))
    await renderLoaded()
    // Tweezer opened set 1 and repeats in the encore unlabeled; Ghost was
    // picked to open set 2 but came later in the set
    expect(screen.getByText("Set 1 Opener")).toBeInTheDocument()
    expect(
      screen.getByText("Set 2 Opener pick (played elsewhere)")
    ).toBeInTheDocument()
    expect(screen.getByText("Encore")).toBeInTheDocument()
    expect(screen.getAllByText("Pick")).toHaveLength(2)
    // Shown both in the setlist and the picks summary
    expect(screen.getAllByText("+3")).toHaveLength(2)
    expect(screen.getByTitle("With a tease")).toBeInTheDocument()
    // Pick summary icons: correct, missed, pending
    expect(
      screen.getByText("✓", {
        selector: ".text-xl.text-green-400.font-semibold",
      })
    ).toBeInTheDocument()
    expect(
      screen.getByText("○", { selector: "span.text-xl.text-slate-500" })
    ).toBeInTheDocument()
  })

  it("labels an opener pick played in a different set as played elsewhere", async () => {
    const data = results()
    data.setlist.songs = [
      { song: "Fee", set: "1", position: 1, footnote: "" },
      { song: "Ghost", set: "1", position: 2, footnote: "" },
    ]
    fetchMock.mockResolvedValue(json(data))
    await renderLoaded()
    expect(
      screen.getByText("Set 2 Opener pick (played elsewhere)")
    ).toBeInTheDocument()
  })

  it("labels an encore pick played in the main set as played elsewhere, with its point", async () => {
    const data = results()
    data.submission.picks = [pick("p2", "Harpua", "ENCORE", true, 1)]
    data.setlist.songs = [
      { song: "Harpua", set: "1", position: 3, footnote: "" },
    ]
    fetchMock.mockResolvedValue(json(data))
    await renderLoaded()
    expect(
      screen.getByText("Encore pick (played elsewhere)")
    ).toBeInTheDocument()
    expect(screen.getAllByText("+1").length).toBeGreaterThan(0)
  })

  it("puts the badge on the in-slot play of a song played more than once", async () => {
    const data = results()
    data.submission.picks = [pick("p5", "Ghost", "OPENER", true, 3, 2)]
    data.setlist.songs = [
      { song: "Fee", set: "1", position: 1, footnote: "" },
      { song: "Ghost", set: "1", position: 2, footnote: "" },
      { song: "Ghost", set: "2", position: 3, footnote: "" },
    ]
    fetchMock.mockResolvedValue(json(data))
    await renderLoaded()
    expect(screen.getByText("Set 2 Opener")).toBeInTheDocument()
    expect(screen.queryByText(/played elsewhere/)).toBeNull()
  })

  it("expands show notes", async () => {
    fetchMock.mockResolvedValue(json(results()))
    await renderLoaded()
    const toggle = screen.getByRole("button", { name: /Show Notes/ })
    expect(screen.queryByText("Fee debut")).toBeNull()
    fireEvent.click(toggle)
    expect(toggle).toHaveAttribute("aria-expanded", "true")
    expect(screen.getByText("Fee debut")).toBeInTheDocument()
    fireEvent.click(toggle)
    expect(screen.queryByText("Fee debut")).toBeNull()
  })

  it("shows waiting state before the setlist and flags test shows", async () => {
    const data = results({ setlist: null })
    data.show.isComplete = false
    data.show.venue = "Test Venue 3"
    data.show.state = ""
    data.submission.totalPoints = 0
    fetchMock.mockResolvedValue(json(data))
    await renderLoaded()
    expect(screen.getByText("Waiting for Show")).toBeInTheDocument()
    expect(
      screen.getByText("Scores will appear here once the show starts")
    ).toBeInTheDocument()
    expect(screen.getByText("TEST SHOW")).toBeInTheDocument()
    expect(screen.queryByText("Setlist")).toBeNull()
  })

  it("polls every minute while the show is in progress", async () => {
    vi.useFakeTimers({ toFake: ["setInterval", "clearInterval"] })
    const data = results()
    data.show.isComplete = false
    fetchMock.mockResolvedValue(json(data))
    await renderLoaded()
    expect(screen.getByText("Show In Progress")).toBeInTheDocument()
    expect(screen.getByText(/Last updated:/)).toBeInTheDocument()
    await act(async () => {
      vi.advanceTimersByTime(60_000)
    })
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })

  it.each([
    [json({}, { ok: false, status: 404 }), "No picks found for this show"],
    [json({}, { ok: false, status: 500 }), "Failed to load results"],
  ])("shows load errors", async (response, message) => {
    fetchMock.mockResolvedValue(response)
    await renderLoaded()
    expect(screen.getByText(message)).toBeInTheDocument()
  })

  it("shows an error when the request throws", async () => {
    fetchMock.mockRejectedValue(new Error("offline"))
    await renderLoaded()
    expect(screen.getByText("Failed to load results")).toBeInTheDocument()
  })

  describe("admin delete", () => {
    beforeEach(() => {
      vi.stubGlobal("alert", vi.fn())
      vi.stubGlobal(
        "confirm",
        vi.fn(() => true)
      )
    })

    it("shows whose picks they are and deletes after confirming", async () => {
      fetchMock
        .mockResolvedValueOnce(json(results()))
        .mockResolvedValueOnce(json({ success: true }))
      await renderLoaded(true)
      expect(screen.getByText("bob's Picks")).toBeInTheDocument()
      await act(async () => {
        fireEvent.click(
          screen.getByRole("button", { name: /Delete Submission/ })
        )
      })
      expect(fetchMock).toHaveBeenLastCalledWith(
        "/api/admin/delete-submission/sub-1",
        {
          method: "DELETE",
        }
      )
      expect(push).toHaveBeenCalledWith("/results")
    })

    it("does nothing when not confirmed", async () => {
      vi.mocked(confirm).mockReturnValue(false)
      fetchMock.mockResolvedValue(json(results()))
      await renderLoaded(true)
      fireEvent.click(screen.getByRole("button", { name: /Delete Submission/ }))
      expect(fetchMock).toHaveBeenCalledTimes(1)
    })

    it("alerts on failure", async () => {
      fetchMock
        .mockResolvedValueOnce(json(results()))
        .mockResolvedValueOnce(json({ error: "Not allowed" }, { ok: false }))
        .mockResolvedValueOnce(json({}, { ok: false }))
        .mockRejectedValueOnce("weird")
      await renderLoaded(true)
      const del = () =>
        act(async () => {
          fireEvent.click(
            screen.getByRole("button", { name: /Delete Submission/ })
          )
        })
      await del()
      expect(alert).toHaveBeenLastCalledWith("Not allowed")
      await del()
      expect(alert).toHaveBeenLastCalledWith("Failed to delete submission")
      await del()
      expect(alert).toHaveBeenLastCalledWith("Failed to delete submission")
    })

    it("alerts when there's no submission id", async () => {
      const data = results()
      data.submission.id = ""
      fetchMock.mockResolvedValue(json(data))
      await renderLoaded(true)
      fireEvent.click(screen.getByRole("button", { name: /Delete Submission/ }))
      expect(alert).toHaveBeenCalledWith(
        expect.stringContaining("No submission found")
      )
    })

    it("falls back to 'Your Picks' when no username is returned", async () => {
      const data = results()
      data.submission.username = undefined as unknown as string
      fetchMock.mockResolvedValue(json(data))
      await renderLoaded(true)
      expect(screen.getByText("Your Picks")).toBeInTheDocument()
    })
  })
})

describe("results_detail page", () => {
  it("builds metadata from the show and tour", async () => {
    db.show.findUnique.mockResolvedValueOnce({
      showDate: new Date("2025-07-04T12:00:00Z"),
      venue: "MSG",
      city: "New York",
      state: "NY",
      tour: { name: "Summer Tour" },
    })
    const meta = await generateMetadata(routeParams({ showId: "show-1" }))
    expect(meta.title).toBe("Phish at MSG - New York, NY")
    expect(meta.description).toContain("Part of the Summer Tour.")
    expect(meta.alternates?.canonical).toBe("/results_detail/show-1")

    db.show.findUnique.mockResolvedValueOnce({
      showDate: new Date("2025-07-04T12:00:00Z"),
      venue: "MSG",
      city: "New York",
      state: "NY",
      tour: null,
    })
    expect(
      (await generateMetadata(routeParams({ showId: "s" }))).description
    ).not.toContain("Part of")

    db.show.findUnique.mockResolvedValueOnce(null)
    expect((await generateMetadata(routeParams({ showId: "s" }))).title).toBe(
      "Show Not Found"
    )
  })

  it("passes admin status to the client", async () => {
    fetchMock.mockReturnValue(new Promise(() => {}))
    vi.mocked(auth).mockResolvedValue({ user: { isAdmin: true } } as never)
    const element = await ResultsPage(routeParams({ showId: "show-1" }))
    expect(element.props).toEqual({ showId: "show-1", isAdmin: true })
    vi.mocked(auth).mockResolvedValue(null as never)
    expect(
      (await ResultsPage(routeParams({ showId: "s" }))).props.isAdmin
    ).toBe(false)
  })
})
