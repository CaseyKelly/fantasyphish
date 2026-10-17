// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { render, screen } from "@testing-library/react"

vi.mock("next/navigation", () => ({
  useRouter: vi.fn(() => ({ push: vi.fn(), refresh: vi.fn() })),
  usePathname: vi.fn(() => "/picks"),
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
vi.mock("next-auth/react", () => ({
  useSession: vi.fn(() => ({ data: null })),
  signOut: vi.fn(),
}))
vi.mock("@/lib/auth", () => ({ auth: vi.fn() }))
vi.mock("@/lib/prisma", async () => {
  const { createPrismaMock } = await import("@/test-utils/prisma-mock")
  return { prisma: createPrismaMock() }
})
vi.mock("@/lib/phishnet", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/phishnet")>()),
  hasShowStarted: vi.fn(),
}))
vi.mock("@/lib/streaks", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/streaks")>()),
  getStreaksForUsers: vi.fn(),
}))
vi.mock("@/lib/private-access", () => ({
  isPrivateViewerOwner: (email?: string | null) => email === "owner@x.com",
}))
vi.mock("@/components/SongPicker", () => ({
  SongPicker: (props: Record<string, unknown>) => (
    <pre data-testid="song-picker">{JSON.stringify(props)}</pre>
  ),
}))
vi.mock("@/components/NotificationSettings", () => ({
  NotificationSettings: (props: Record<string, unknown>) => (
    <div data-testid="notification-settings">{JSON.stringify(props)}</div>
  ),
}))

import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { hasShowStarted } from "@/lib/phishnet"
import { getStreaksForUsers } from "@/lib/streaks"
import { resetPrismaMock, type PrismaMock } from "@/test-utils/prisma-mock"
import { routeParams } from "@/test-utils/request"
import MainLayout from "./layout"
import PicksLayout from "./picks/layout"
import PicksPage from "./picks/page"
import PickPage, {
  generateMetadata as pickMetadata,
} from "./pick/[showId]/page"
import ProfilePage from "./profile/page"
import UserProfilePage, {
  generateMetadata as userMetadata,
} from "./user/[username]/page"
import SubmissionsPage from "./submissions/page"

const db = prisma as unknown as PrismaMock
const authMock = vi.mocked(auth)
const fetchMock = vi.fn()

function session(user: Record<string, unknown> = {}) {
  return {
    user: { id: "u1", username: "alice", email: "a@x.com", ...user },
  } as never
}

function pickerProps() {
  return JSON.parse(screen.getByTestId("song-picker").textContent!)
}

beforeEach(() => {
  vi.clearAllMocks()
  resetPrismaMock(db)
  vi.stubGlobal("fetch", fetchMock)
  fetchMock.mockReturnValue(new Promise(() => {}))
  vi.spyOn(console, "error").mockImplementation(() => {})
})

afterEach(() => {
  vi.unstubAllGlobals()
  vi.unstubAllEnvs()
})

describe("layouts", () => {
  it("main layout adds the impersonation banner and feedback only when signed in", async () => {
    authMock.mockResolvedValueOnce(session())
    const { unmount } = render(await MainLayout({ children: <p>page</p> }))
    expect(screen.getByText("page")).toBeInTheDocument()
    expect(screen.getByText("Skip to main content")).toHaveAttribute(
      "href",
      "#main-content"
    )
    expect(screen.getByText("Email Chalupa")).toBeInTheDocument()
    unmount()

    authMock.mockResolvedValueOnce(null as never)
    render(await MainLayout({ children: <p>page</p> }))
    expect(screen.queryByText("Email Chalupa")).toBeNull()
  })

  it("picks layout passes children through", () => {
    render(
      <PicksLayout>
        <p>child</p>
      </PicksLayout>
    )
    expect(screen.getByText("child")).toBeInTheDocument()
  })
})

describe("/picks", () => {
  it("shows the format poll while it's enabled", () => {
    render(<PicksPage />)
    expect(
      screen.getByText("Help shape the next tour's format")
    ).toBeInTheDocument()
    expect(fetchMock).toHaveBeenCalledWith("/api/polls/set2-opener-format", {
      cache: "no-store",
    })
  })
})

describe("/pick/[showId]", () => {
  const show = {
    id: "s1",
    venue: "MSG",
    city: "New York",
    state: "NY",
    showDate: new Date("2025-07-04T00:00:00Z"),
    timezone: "America/New_York",
    isComplete: false,
    submissions: [] as unknown[],
  }

  it("builds metadata", async () => {
    db.show.findUnique.mockResolvedValueOnce({
      ...show,
      tour: { name: "Summer" },
    })
    const meta = await pickMetadata(routeParams({ showId: "s1" }))
    expect(meta.title).toBe("Make Picks for Phish at MSG - New York, NY")
    expect(meta.description).toContain("Part of the Summer.")
    db.show.findUnique.mockResolvedValueOnce({ ...show, tour: null })
    expect(
      (await pickMetadata(routeParams({ showId: "s1" }))).description
    ).not.toContain("Part of")
    db.show.findUnique.mockResolvedValueOnce(null)
    expect((await pickMetadata(routeParams({ showId: "x" }))).title).toBe(
      "Show Not Found"
    )
  })

  it("requires a session and an existing show", async () => {
    authMock.mockResolvedValue(null as never)
    await expect(PickPage(routeParams({ showId: "s1" }))).rejects.toThrow(
      "REDIRECT:/login"
    )
    authMock.mockResolvedValue(session())
    db.show.findUnique.mockResolvedValue(null)
    await expect(PickPage(routeParams({ showId: "x" }))).rejects.toThrow(
      "NOT_FOUND"
    )
  })

  it("renders the picker with existing picks and no reminder nudge", async () => {
    authMock.mockResolvedValue(session())
    db.show.findUnique.mockResolvedValue({
      ...show,
      submissions: [
        {
          totalPoints: 4,
          picks: [
            {
              songId: "a",
              song: { name: "Tweezer" },
              pickType: "OPENER",
              wasPlayed: true,
              pointsEarned: 3,
            },
          ],
        },
      ],
    })
    db.song.findMany.mockResolvedValue([{ id: "a", name: "Tweezer" }])
    db.user.findUnique.mockResolvedValue({
      emailPickReminders: true,
      _count: { pushSubscriptions: 0 },
    })
    vi.mocked(hasShowStarted).mockResolvedValue(true)

    render(await PickPage(routeParams({ showId: "s1" })))

    const props = pickerProps()
    expect(props.isLocked).toBe(true)
    expect(props.totalPoints).toBe(4)
    expect(props.existingPicks).toEqual([
      {
        songId: "a",
        songName: "Tweezer",
        pickType: "OPENER",
        wasPlayed: true,
        pointsEarned: 3,
      },
    ])
    expect(props.show.showDate).toBe("2025-07-04T00:00:00.000Z")
    expect(hasShowStarted).toHaveBeenCalledWith(
      "2025-07-04",
      "America/New_York",
      "NY"
    )
    expect(screen.queryByText("your profile")).toBeNull()
  })

  it("nudges users without notifications toward their profile", async () => {
    authMock.mockResolvedValue(session())
    db.show.findUnique.mockResolvedValue({ ...show, city: null, state: null })
    db.song.findMany.mockResolvedValue([])
    db.user.findUnique.mockResolvedValue(null)
    vi.mocked(hasShowStarted).mockResolvedValue(false)
    render(await PickPage(routeParams({ showId: "s1" })))
    expect(screen.getByText("your profile")).toHaveAttribute(
      "href",
      "/user/alice"
    )
    expect(pickerProps().show.city).toBe("")
    expect(pickerProps().existingPicks).toBeUndefined()
  })

  it("treats push subscriptions as notifications enabled", async () => {
    authMock.mockResolvedValue(session())
    db.show.findUnique.mockResolvedValue(show)
    db.song.findMany.mockResolvedValue([])
    db.user.findUnique.mockResolvedValue({
      emailPickReminders: false,
      _count: { pushSubscriptions: 1 },
    })
    vi.mocked(hasShowStarted).mockResolvedValue(false)
    render(await PickPage(routeParams({ showId: "s1" })))
    expect(screen.queryByText("your profile")).toBeNull()
  })
})

describe("/profile", () => {
  it("redirects to login or to the user's public profile", async () => {
    authMock.mockResolvedValueOnce(null as never)
    await expect(ProfilePage()).rejects.toThrow("REDIRECT:/login")

    authMock.mockResolvedValue(session())
    db.user.findUnique.mockResolvedValueOnce(null)
    await expect(ProfilePage()).rejects.toThrow("REDIRECT:/login")
    db.user.findUnique.mockResolvedValueOnce({ username: "alice" })
    await expect(ProfilePage()).rejects.toThrow("REDIRECT:/user/alice")
  })
})

describe("/user/[username]", () => {
  const p = (pickType: string, name: string, wasPlayed: boolean | null) => ({
    pickType,
    wasPlayed,
    pointsEarned: wasPlayed ? (pickType === "REGULAR" ? 1 : 3) : 0,
    song: { id: name, name },
  })
  const past = new Date(Date.now() - 60_000)
  const future = new Date(Date.now() + 60_000)

  function user(overrides: Record<string, unknown> = {}) {
    return {
      id: "u1",
      username: "alice",
      createdAt: new Date("2024-01-15T12:00:00Z"),
      emailPickReminders: true,
      emailVerified: new Date(),
      submissions: [
        {
          showId: "s1",
          isScored: true,
          totalPoints: 7,
          show: {
            lockTime: past,
            isComplete: true,
            venue: "MSG",
            showDate: new Date("2025-07-04T12:00:00Z"),
          },
          picks: [
            p("OPENER", "Tweezer", true),
            p("ENCORE", "Harpua", true),
            p("REGULAR", "Fee", true),
          ],
        },
        {
          showId: "s2",
          isScored: false,
          totalPoints: null,
          show: {
            lockTime: past,
            isComplete: false,
            venue: "Dicks",
            showDate: new Date("2025-08-30T12:00:00Z"),
          },
          picks: [p("OPENER", "Tweezer", false), p("REGULAR", "Fee", null)],
        },
        {
          showId: "s3",
          isScored: false,
          totalPoints: null,
          show: {
            lockTime: future,
            isComplete: false,
            venue: "Future",
            showDate: new Date(),
          },
          picks: [],
        },
      ],
      achievements: [
        {
          id: "ua1",
          achievement: {
            slug: "founding-member",
            icon: "🍩",
            name: "Founder",
            description: "hidden",
          },
        },
        {
          id: "ua2",
          achievement: {
            slug: "jackpot",
            icon: "🐈",
            name: "Jackpot",
            description: "Harpua!",
          },
        },
      ],
      ...overrides,
    }
  }

  it("builds metadata", async () => {
    db.user.findUnique.mockResolvedValueOnce({ username: "alice" })
    expect((await userMetadata(routeParams({ username: "alice" }))).title).toBe(
      "alice's Profile"
    )
    db.user.findUnique.mockResolvedValueOnce(null)
    expect((await userMetadata(routeParams({ username: "x" }))).title).toBe(
      "User Not Found"
    )
  })

  it("404s for unknown users", async () => {
    db.user.findUnique.mockResolvedValue(null)
    authMock.mockResolvedValue(null as never)
    await expect(
      UserProfilePage(routeParams({ username: "x" }))
    ).rejects.toThrow("NOT_FOUND")
  })

  it("shows stats, breakdown, achievements, and own-profile controls", async () => {
    db.user.findUnique.mockResolvedValue(user())
    vi.mocked(getStreaksForUsers).mockResolvedValue(
      new Map([["u1", { current: 4, best: 6 }]])
    )
    db.show.findFirst.mockResolvedValue({ id: "s9", venue: "Sphere" })
    authMock.mockResolvedValue(session())

    render(await UserProfilePage(routeParams({ username: "alice" })))

    expect(screen.getByRole("heading", { name: "alice" })).toBeInTheDocument()
    expect(screen.getByText("7 points")).toBeInTheDocument()
    expect(screen.getByText(/MSG • Jul 4, 2025/)).toBeInTheDocument()
    expect(screen.getByText("January 15, 2024")).toBeInTheDocument()
    expect(screen.getByText("3.5")).toBeInTheDocument()
    expect(screen.getByText("3/26")).toBeInTheDocument()
    expect(screen.getByText(/Pick for Sphere to keep your/)).toHaveAttribute(
      "href",
      "/pick/s9"
    )
    expect(screen.getByText("Pick Breakdown")).toBeInTheDocument()
    expect(screen.getByText("Picked 2×")).toBeInTheDocument()
    expect(screen.getByText("Founder")).toBeInTheDocument()
    expect(screen.getByText("Jackpot")).toBeInTheDocument()
    expect(
      JSON.parse(screen.getByTestId("notification-settings").textContent!)
    ).toEqual({
      initialEmailEnabled: true,
      emailVerified: true,
    })
  })

  it("hides private controls on someone else's profile and handles a new player", async () => {
    db.user.findUnique.mockResolvedValue(
      user({ submissions: [], achievements: [], emailVerified: null })
    )
    vi.mocked(getStreaksForUsers).mockResolvedValue(new Map())
    db.show.findFirst.mockResolvedValue({ id: "s9", venue: "Sphere" })
    authMock.mockResolvedValue(session({ username: "bob" }))

    render(await UserProfilePage(routeParams({ username: "alice" })))

    expect(screen.queryByText("Best Show Score")).toBeNull()
    expect(screen.queryByText("Pick Breakdown")).toBeNull()
    expect(screen.queryByText("Achievements")).toBeNull()
    expect(screen.queryByTestId("notification-settings")).toBeNull()
    expect(screen.queryByText(/keep your/)).toBeNull()
  })

  it("doesn't prompt about a streak when you've already picked the next show", async () => {
    db.user.findUnique.mockResolvedValue(user())
    vi.mocked(getStreaksForUsers).mockResolvedValue(
      new Map([["u1", { current: 2, best: 2 }]])
    )
    db.show.findFirst.mockResolvedValue({ id: "s3", venue: "Future" })
    authMock.mockResolvedValue(session())
    render(await UserProfilePage(routeParams({ username: "alice" })))
    expect(screen.queryByText(/keep your/)).toBeNull()
  })
})

describe("/submissions", () => {
  it("requires the private viewer", async () => {
    authMock.mockResolvedValueOnce(null as never)
    await expect(SubmissionsPage()).rejects.toThrow("REDIRECT:/login")
    authMock.mockResolvedValueOnce(session())
    await expect(SubmissionsPage()).rejects.toThrow("NOT_FOUND")
  })

  it("handles no upcoming show", async () => {
    authMock.mockResolvedValue(session({ email: "owner@x.com" }))
    db.show.findFirst.mockResolvedValue(null)
    render(await SubmissionsPage())
    expect(screen.getByText("No upcoming show found.")).toBeInTheDocument()
  })

  it("lists each submission's picks", async () => {
    authMock.mockResolvedValue(session({ email: "owner@x.com" }))
    db.show.findFirst.mockResolvedValue({
      id: "s1",
      venue: "MSG",
      city: "New York",
      state: "NY",
      showDate: new Date("2025-07-04T00:00:00Z"),
    })
    const pick = (id: string, pickType: string, name: string) => ({
      id,
      pickType,
      song: { name },
    })
    db.submission.findMany.mockResolvedValue([
      {
        id: "sub1",
        createdAt: new Date("2025-07-01T12:00:00Z"),
        user: { username: "alice" },
        picks: [
          pick("1", "OPENER", "Tweezer"),
          pick("2", "REGULAR", "Ghost"),
          pick("3", "REGULAR", "Fee"),
        ],
      },
    ])
    render(await SubmissionsPage())
    expect(
      screen.getByText(/MSG, New York, NY • July 4, 2025/)
    ).toBeInTheDocument()
    expect(screen.getByText("1 submission")).toBeInTheDocument()
    expect(screen.getByText("Tweezer")).toBeInTheDocument()
    expect(screen.getByText("—")).toBeInTheDocument()
    expect(screen.getAllByRole("listitem").map((li) => li.textContent)).toEqual(
      ["Fee", "Ghost"]
    )
  })

  it("shows when nobody has picked yet", async () => {
    authMock.mockResolvedValue(session({ email: "owner@x.com" }))
    db.show.findFirst.mockResolvedValue({
      id: "s1",
      venue: "MSG",
      city: null,
      state: null,
      showDate: new Date(),
    })
    db.submission.findMany.mockResolvedValue([])
    render(await SubmissionsPage())
    expect(screen.getByText("0 submissions")).toBeInTheDocument()
    expect(screen.getByText("No picks submitted yet.")).toBeInTheDocument()
  })
})
