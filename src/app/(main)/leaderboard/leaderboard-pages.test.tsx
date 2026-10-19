// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen } from "@testing-library/react"

vi.mock("next/navigation", () => ({
  useRouter: vi.fn(() => ({ refresh: vi.fn() })),
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
vi.mock("@/lib/auth", () => ({ auth: vi.fn() }))
vi.mock("@/lib/prisma", async () => {
  const { createPrismaMock } = await import("@/test-utils/prisma-mock")
  return { prisma: createPrismaMock() }
})
vi.mock("@/lib/leaderboard", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/leaderboard")>()),
  getLeaderboard: vi.fn(async () => []),
  getCurrentOrLastShow: vi.fn(async () => null),
}))

import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { getLeaderboard, getCurrentOrLastShow } from "@/lib/leaderboard"
import { resetPrismaMock, type PrismaMock } from "@/test-utils/prisma-mock"
import { routeParams } from "@/test-utils/request"
import HistoryPage from "./history/page"
import TourLeaderboardPage, { generateMetadata } from "./[tourId]/page"

const db = prisma as unknown as PrismaMock

beforeEach(() => {
  vi.clearAllMocks()
  resetPrismaMock(db)
})

describe("leaderboard history page", () => {
  it("shows an empty state when no closed tour has participants", async () => {
    db.tour.findMany.mockResolvedValue([
      {
        id: "t1",
        name: "Synced Only",
        shows: [{ id: "s" }],
        startDate: new Date(),
        endDate: null,
      },
    ])
    db.submission.findMany.mockResolvedValue([])
    render(await HistoryPage())
    expect(screen.getByText("No past tours yet.")).toBeInTheDocument()
  })

  it("lists past tours with their top three", async () => {
    db.tour.findMany.mockResolvedValue([
      {
        id: "t1",
        name: "Fall Tour",
        startDate: new Date("2024-10-01T00:00:00Z"),
        endDate: new Date("2024-10-31T00:00:00Z"),
        shows: [{ id: "s1" }, { id: "s2" }],
      },
      {
        id: "t2",
        name: "NYE Run",
        startDate: new Date("2024-12-28T00:00:00Z"),
        endDate: null,
        shows: [{ id: "s3" }],
      },
    ])
    const sub = (userId: string, totalPoints: number | null) => ({
      userId,
      totalPoints,
      user: { username: userId },
    })
    db.submission.findMany
      .mockResolvedValueOnce([
        sub("alice", 10),
        sub("alice", 5),
        sub("bob", 8),
        sub("carol", 1),
        sub("dave", null),
      ])
      .mockResolvedValueOnce([sub("erin", 1)])

    render(await HistoryPage())

    expect(screen.getByText("Fall Tour")).toBeInTheDocument()
    expect(screen.getByText("Oct 1, 2024 - Oct 31, 2024")).toBeInTheDocument()
    expect(screen.getByText("2 shows • 4 participants")).toBeInTheDocument()
    expect(screen.getByText("🥇 #1 alice")).toBeInTheDocument()
    expect(screen.getByText("15 pts")).toBeInTheDocument()
    expect(screen.getByText("🥈 #2 bob")).toBeInTheDocument()
    expect(screen.getByText("🥉 #3 carol")).toBeInTheDocument()
    expect(screen.queryByText(/dave/)).toBeNull()
    expect(screen.getByText("1 show • 1 participant")).toBeInTheDocument()
    expect(screen.getAllByText("1 pt")).toHaveLength(2)
    expect(screen.getByText("Dec 28, 2024")).toBeInTheDocument()
    expect(screen.getAllByText("View Full Results")[0]).toHaveAttribute(
      "href",
      "/leaderboard/t1"
    )
  })
})

describe("tour leaderboard page", () => {
  it("builds metadata", async () => {
    db.tour.findUnique.mockResolvedValueOnce({ name: "Fall Tour" })
    const meta = await generateMetadata(routeParams({ tourId: "t1" }))
    expect(meta.title).toBe("Fall Tour Leaderboard")
    expect(meta.alternates?.canonical).toBe("/leaderboard/t1")
    db.tour.findUnique.mockResolvedValueOnce(null)
    expect((await generateMetadata(routeParams({ tourId: "x" }))).title).toBe(
      "Tour Not Found"
    )
  })

  it("404s for unknown tours", async () => {
    db.tour.findUnique.mockResolvedValue(null)
    await expect(
      TourLeaderboardPage(routeParams({ tourId: "x" }))
    ).rejects.toThrow("NOT_FOUND")
  })

  it("renders the closed tour's final standings with a back link", async () => {
    vi.mocked(auth).mockResolvedValue({ user: { id: "u1" } } as never)
    db.tour.findUnique.mockResolvedValue({
      id: "t1",
      name: "Fall Tour",
      startDate: new Date("2024-10-01T00:00:00Z"),
      endDate: new Date("2024-10-31T00:00:00Z"),
      status: "CLOSED",
      shows: [
        {
          venue: "MSG",
          city: "NYC",
          state: "NY",
          showDate: new Date("2024-10-01T00:00:00Z"),
        },
      ],
    })
    vi.mocked(getCurrentOrLastShow).mockResolvedValue({
      id: "s9",
      showDate: new Date("2024-10-31T00:00:00Z"),
      venue: "MSG",
      city: "NYC",
      state: "NY",
      isComplete: true,
      setlistJson: {
        setlistnotes: "",
        songs: [{ song: "Tweezer", set: "1", position: 1, footnote: "" }],
      },
    } as never)
    render(await TourLeaderboardPage(routeParams({ tourId: "t1" })))
    expect(screen.getByText("Back to History")).toHaveAttribute(
      "href",
      "/leaderboard/history"
    )
    expect(
      screen.getByText("Tour Complete - Final Results")
    ).toBeInTheDocument()
    expect(getLeaderboard).toHaveBeenCalledTimes(2)
  })

  it("handles a tour with no shows or current show", async () => {
    vi.mocked(auth).mockResolvedValue(null as never)
    db.tour.findUnique.mockResolvedValue({ id: "t1", name: "Empty", shows: [] })
    vi.mocked(getCurrentOrLastShow).mockResolvedValue(null)
    render(await TourLeaderboardPage(routeParams({ tourId: "t1" })))
    expect(screen.getByText("No scores yet for this tour.")).toBeInTheDocument()
    expect(getLeaderboard).toHaveBeenCalledTimes(1)
  })
})
