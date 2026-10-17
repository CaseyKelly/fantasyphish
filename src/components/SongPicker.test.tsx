// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import {
  render,
  screen,
  fireEvent,
  act,
  waitFor,
  within,
} from "@testing-library/react"

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
vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn(), info: vi.fn() },
}))
vi.mock("@/lib/pickDraft", () => ({
  readPickDraft: vi.fn(() => null),
  writePickDraft: vi.fn(),
  clearPickDraft: vi.fn(),
}))

import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { readPickDraft, writePickDraft, clearPickDraft } from "@/lib/pickDraft"
import { SongPicker } from "./SongPicker"

const push = vi.fn()
const refresh = vi.fn()
const fetchMock = vi.fn()

const songs = Array.from({ length: 15 }, (_, i) => ({
  id: `s${i}`,
  name: `Song ${String.fromCharCode(65 + i)}`,
  slug: `song-${i}`,
  artist: i === 14 ? "Trey" : "Phish",
  timesPlayed: 10,
  gap: i === 0 ? 0 : i === 1 ? null : i,
  lastPlayed: null,
}))
const name = (i: number) => songs[i].name

const show = {
  id: "show-1",
  venue: "MSG",
  city: "New York",
  state: "NY",
  showDate: "2025-07-04T00:00:00.000Z",
}

type PickType = "OPENER" | "ENCORE" | "REGULAR"
function pick(
  i: number,
  pickType: PickType,
  extra: Record<string, unknown> = {}
) {
  return { songId: songs[i].id, songName: songs[i].name, pickType, ...extra }
}
function fullPicks(extra: (i: number) => Record<string, unknown> = () => ({})) {
  return [
    pick(0, "OPENER", extra(0)),
    pick(1, "ENCORE", extra(1)),
    ...Array.from({ length: 11 }, (_, k) =>
      pick(k + 2, "REGULAR", extra(k + 2))
    ),
  ]
}

function songButton(songName: string): HTMLElement {
  const match = screen
    .getAllByRole("button")
    .find(
      (b) =>
        b.hasAttribute("aria-pressed") &&
        b.querySelector("p")?.textContent === songName
    )
  if (!match) throw new Error(`No song button for ${songName}`)
  return match
}

function setWidth(width: number) {
  Object.defineProperty(window, "innerWidth", {
    configurable: true,
    value: width,
  })
}

function selectAllDesktop() {
  fireEvent.click(songButton(name(0)))
  fireEvent.click(songButton(name(1)))
  for (let i = 2; i < 13; i++) fireEvent.click(songButton(name(i)))
}

function json(body: unknown, ok = true) {
  return { ok, json: async () => body }
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(useRouter).mockReturnValue({ push, refresh } as never)
  vi.mocked(readPickDraft).mockReturnValue(null)
  vi.stubGlobal("fetch", fetchMock)
  setWidth(1024)
  vi.spyOn(console, "error").mockImplementation(() => {})
})

afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllGlobals()
})

describe("SongPicker (desktop)", () => {
  it("renders the show header and gap hints", () => {
    render(<SongPicker show={show} songs={songs} isLocked={false} />)
    expect(screen.getByText("Make Your Picks")).toBeInTheDocument()
    expect(screen.getByText("July 4, 2025")).toBeInTheDocument()
    expect(screen.getByText("New York, NY")).toBeInTheDocument()
    expect(
      within(songButton(name(0))).getByText(/played 1 show ago/)
    ).toBeInTheDocument()
    expect(
      within(songButton(name(2))).getByText(/played 3 shows ago/)
    ).toBeInTheDocument()
    expect(within(songButton(name(1))).queryByText(/played/)).toBeNull()
    expect(screen.getByText("Complete your picks")).toBeInTheDocument()
  })

  it("walks through opener, encore, and regular picks, then submits", async () => {
    fetchMock.mockResolvedValue(json({ message: "Saved!" }))
    render(
      <SongPicker show={show} songs={songs} isLocked={false} userId="u1" />
    )

    fireEvent.click(songButton(name(0)))
    // Opener chosen: the encore section opens next
    expect(screen.getByText("Encore Pick").closest("button")).toHaveAttribute(
      "aria-expanded",
      "true"
    )
    expect(screen.getByText("Unsaved changes")).toBeInTheDocument()
    expect(
      screen.getByText("12 picks remaining — not yet saved")
    ).toBeInTheDocument()

    fireEvent.click(songButton(name(1)))
    for (let i = 2; i < 13; i++) fireEvent.click(songButton(name(i)))

    // Regular section collapses once all 11 are picked
    expect(screen.getByText("Complete")).toBeInTheDocument()
    expect(
      screen.getByText("Click submit to save your picks")
    ).toBeInTheDocument()

    const submit = screen.getByRole("button", { name: /Submit Picks/ })
    expect(submit).toBeEnabled()
    await act(async () => {
      fireEvent.click(submit)
    })

    const body = JSON.parse(fetchMock.mock.calls[0][1].body)
    expect(body.showId).toBe("show-1")
    expect(body.picks).toHaveLength(13)
    expect(toast.success).toHaveBeenCalledWith("Saved!")
    expect(clearPickDraft).toHaveBeenCalledWith("u1", "show-1")
    expect(push).toHaveBeenCalledWith("/picks")
    expect(screen.getByText("Picks saved!")).toBeInTheDocument()
  })

  it("clears the saved banner after 3 seconds and when picks change again", async () => {
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] })
    fetchMock.mockResolvedValue(json({}))
    const onSubmitSuccess = vi.fn()
    render(
      <SongPicker
        show={show}
        songs={songs}
        isLocked={false}
        onSubmitSuccess={onSubmitSuccess}
      />
    )
    selectAllDesktop()
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /Submit Picks/ }))
    })
    expect(onSubmitSuccess).toHaveBeenCalled()
    expect(push).not.toHaveBeenCalled()
    expect(toast.success).toHaveBeenCalledWith("Picks submitted successfully!")
    expect(screen.getByText("Picks saved!")).toBeInTheDocument()
    act(() => {
      vi.advanceTimersByTime(3000)
    })
    expect(screen.queryByText("Picks saved!")).not.toBeInTheDocument()

    // Saving again, then removing a pick, also clears it
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /Submit Picks/ }))
    })
    fireEvent.click(screen.getByText(/Regular Picks/))
    fireEvent.click(screen.getByRole("button", { name: `Remove ${name(2)}` }))
    expect(screen.queryByText("Picks saved!")).not.toBeInTheDocument()
  })

  it("shows server and network errors", async () => {
    fetchMock
      .mockResolvedValueOnce(json({ error: "Show locked" }, false))
      .mockResolvedValueOnce(json({}, false))
      .mockRejectedValueOnce(new Error("offline"))
    render(<SongPicker show={show} songs={songs} isLocked={false} />)
    selectAllDesktop()
    const submit = screen.getByRole("button", { name: /Submit Picks/ })
    await act(async () => {
      fireEvent.click(submit)
    })
    expect(toast.error).toHaveBeenLastCalledWith("Show locked")
    await act(async () => {
      fireEvent.click(submit)
    })
    expect(toast.error).toHaveBeenLastCalledWith("Failed to submit picks")
    await act(async () => {
      fireEvent.click(submit)
    })
    expect(toast.error).toHaveBeenLastCalledWith("An unexpected error occurred")
  })

  it("hands picks to onGuestSubmit in guest mode", () => {
    const onGuestSubmit = vi.fn()
    render(
      <SongPicker
        show={show}
        songs={songs}
        isLocked={false}
        guestMode
        onGuestSubmit={onGuestSubmit}
      />
    )
    expect(screen.queryByText("Make Your Picks")).not.toBeInTheDocument()
    selectAllDesktop()
    fireEvent.click(screen.getByRole("button", { name: /Submit Picks/ }))
    expect(onGuestSubmit.mock.calls[0][0]).toHaveLength(13)
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it("removes opener and encore picks and toggles sections", () => {
    render(<SongPicker show={show} songs={songs} isLocked={false} hideHeader />)
    expect(screen.queryByText("Make Your Picks")).not.toBeInTheDocument()

    fireEvent.click(songButton(name(0)))
    fireEvent.click(songButton(name(1)))
    // Re-open the encore section to remove the pick
    const encoreHeader = screen.getByText("Encore Pick").closest("button")!
    fireEvent.click(encoreHeader)
    expect(encoreHeader).toHaveAttribute("aria-expanded", "true")
    fireEvent.click(screen.getByText(`Remove: ${name(1)}`))
    expect(screen.getAllByText("Not selected")).toHaveLength(1)

    const openerHeader = screen.getByText("Opener Pick").closest("button")!
    fireEvent.click(openerHeader)
    fireEvent.click(screen.getByText(`Remove: ${name(0)}`))
    expect(screen.getAllByText("Not selected")).toHaveLength(2)
    fireEvent.click(openerHeader)
    expect(openerHeader).toHaveAttribute("aria-expanded", "false")
  })

  it("filters songs by name or artist and clears the search", () => {
    render(<SongPicker show={show} songs={songs} isLocked={false} />)
    const search = screen.getByRole("textbox", { name: "Search songs" })
    fireEvent.change(search, { target: { value: "trey" } })
    expect(songButton(name(14))).toBeInTheDocument()
    expect(() => songButton(name(0))).toThrow()
    fireEvent.change(search, { target: { value: "zzz" } })
    expect(screen.getByText("No songs found")).toBeInTheDocument()
    fireEvent.click(screen.getByRole("button", { name: "Clear search" }))
    expect(search).toHaveValue("")
  })

  it("tracks unsaved edits to an existing submission", () => {
    render(
      <SongPicker
        show={show}
        songs={songs}
        isLocked={false}
        existingPicks={fullPicks()}
      />
    )
    expect(screen.getByText("Picks saved")).toBeInTheDocument()
    expect(screen.getByText("All picks completed")).toBeInTheDocument()
    expect(screen.getByRole("button", { name: /Update Picks/ })).toBeEnabled()

    // Swap the opener for another song
    fireEvent.click(screen.getByText(`Remove: ${name(0)}`))
    fireEvent.click(songButton(name(13)))
    expect(screen.getByText("Unsaved changes")).toBeInTheDocument()
    expect(
      screen.getByText("Click update to save your changes")
    ).toBeInTheDocument()
  })

  it("detects a swapped regular pick as unsaved", () => {
    render(
      <SongPicker
        show={show}
        songs={songs}
        isLocked={false}
        existingPicks={fullPicks()}
      />
    )
    fireEvent.click(screen.getByText(/Regular Picks/))
    fireEvent.click(screen.getByRole("button", { name: `Remove ${name(2)}` }))
    fireEvent.click(songButton(name(13)))
    expect(screen.getByText("Unsaved changes")).toBeInTheDocument()
    // Encore change is detected too
    fireEvent.click(screen.getByText("Encore Pick").closest("button")!)
    fireEvent.click(screen.getByText(`Remove: ${name(1)}`))
    expect(
      screen.getByText("1 picks remaining — not yet saved")
    ).toBeInTheDocument()
  })
})

describe("SongPicker locked panel", () => {
  it("tells users without picks that picks are closed, with a guest sign-up link", () => {
    const { rerender } = render(
      <SongPicker show={show} songs={songs} isLocked />
    )
    expect(screen.getByText("Show In Progress")).toBeInTheDocument()
    expect(screen.getByText("LIVE")).toBeInTheDocument()
    expect(screen.getByText("Picks Are Closed")).toBeInTheDocument()
    expect(screen.queryByText("Sign Up To Play")).not.toBeInTheDocument()
    // Song buttons are disabled while locked
    expect(songButton(name(0))).toBeDisabled()
    fireEvent.click(songButton(name(0)))

    rerender(
      <SongPicker
        show={{ ...show, isComplete: true }}
        songs={songs}
        isLocked
        guestMode
      />
    )
    expect(screen.getByText("Sign Up To Play")).toHaveAttribute(
      "href",
      "/register"
    )
  })

  it("says the show is over for completed shows without picks", () => {
    render(
      <SongPicker show={{ ...show, isComplete: true }} songs={songs} isLocked />
    )
    expect(screen.getByText("That One's In The Books")).toBeInTheDocument()
  })

  it("shows saved picks before scoring starts", () => {
    render(
      <SongPicker
        show={show}
        songs={songs}
        isLocked
        existingPicks={fullPicks()}
      />
    )
    expect(screen.getByText("Your Picks Are Locked In")).toBeInTheDocument()
    expect(screen.getByText("Your picks are saved")).toBeInTheDocument()
    expect(screen.queryByRole("button", { name: /Update Picks/ })).toBeNull()
  })

  it("shows live scoring results", () => {
    render(
      <SongPicker
        show={{ ...show, isComplete: true }}
        songs={songs}
        isLocked
        existingPicks={fullPicks((i) => ({
          wasPlayed: i === 0 || i === 2 ? true : i === 3 ? null : false,
        }))}
        totalPoints={4}
      />
    )
    expect(screen.getByText("+3")).toBeInTheDocument()
    expect(screen.getByText("0")).toBeInTheDocument()
    expect(screen.getByText("Final score:")).toBeInTheDocument()
    expect(screen.getByText("4 pts")).toBeInTheDocument()
  })

  it("polls results every 10 minutes until the show completes", async () => {
    vi.useFakeTimers({ toFake: ["setInterval", "clearInterval"] })
    fetchMock
      .mockResolvedValueOnce(json({}, false))
      .mockRejectedValueOnce(new Error("offline"))
      .mockResolvedValueOnce(
        json({
          show: { isComplete: false },
          submission: {
            totalPoints: 3,
            picks: [
              {
                song: name(0),
                pickType: "OPENER",
                wasPlayed: true,
                pointsEarned: 3,
              },
            ],
          },
        })
      )
      .mockResolvedValueOnce(
        json({
          show: { isComplete: true },
          submission: { totalPoints: null, picks: [] },
        })
      )

    render(
      <SongPicker
        show={show}
        songs={songs}
        isLocked
        existingPicks={fullPicks()}
      />
    )

    const tick = async () => {
      await act(async () => {
        vi.advanceTimersByTime(10 * 60 * 1000)
      })
    }
    await tick()
    await tick()
    expect(console.error).toHaveBeenCalledWith(
      "Error refreshing live scoring:",
      expect.any(Error)
    )
    await tick()
    expect(screen.getByText("Score so far:")).toBeInTheDocument()
    expect(screen.getByText("3 pts")).toBeInTheDocument()
    await tick()
    expect(
      screen.getByText("The show is over — here's how you did!")
    ).toBeInTheDocument()
    // The final payload had no scored picks to merge
    expect(screen.getByText("Your picks are saved")).toBeInTheDocument()
    expect(fetchMock).toHaveBeenCalledWith("/api/results/show-1")

    // Polling stops once complete
    await tick()
    expect(fetchMock).toHaveBeenCalledTimes(4)
  })
})

describe("SongPicker (mobile)", () => {
  beforeEach(() => {
    setWidth(375)
  })

  it("picks opener and encore through modal dialogs", () => {
    render(<SongPicker show={show} songs={songs} isLocked={false} />)
    expect(screen.queryByRole("textbox")).toBeNull()

    fireEvent.click(screen.getByText("Opener Pick").closest("button")!)
    let dialog = screen.getByRole("dialog")
    expect(within(dialog).getByText("Select Opener")).toBeInTheDocument()
    expect(document.body.style.overflow).toBe("hidden")
    fireEvent.click(songButton(name(0)))
    expect(screen.queryByRole("dialog")).toBeNull()
    expect(document.body.style.overflow).toBe("")

    // Reopen: current selection can be cleared
    fireEvent.click(screen.getByText("Opener Pick").closest("button")!)
    fireEvent.click(screen.getByText(`Current: ${name(0)}`))
    expect(screen.queryByText(`Current: ${name(0)}`)).toBeNull()
    fireEvent.click(screen.getByRole("button", { name: "Close" }))

    fireEvent.click(screen.getByText("Encore Pick").closest("button")!)
    dialog = screen.getByRole("dialog")
    expect(within(dialog).getByText("Select Encore")).toBeInTheDocument()
    fireEvent.click(songButton(name(1)))
    expect(screen.queryByRole("dialog")).toBeNull()
  })

  it("selects 11 regular picks in the modal, with search and removal", () => {
    render(<SongPicker show={show} songs={songs} isLocked={false} />)
    fireEvent.click(screen.getByText("Regular Picks").closest("button")!)
    const search = screen.getByRole("textbox", { name: "Search songs" })
    fireEvent.change(search, { target: { value: name(2) } })
    fireEvent.click(songButton(name(2)))
    fireEvent.click(screen.getByRole("button", { name: "Clear search" }))
    expect(screen.getByText("Selected (1/11):")).toBeInTheDocument()
    fireEvent.click(screen.getByRole("button", { name: `Remove ${name(2)}` }))
    expect(screen.queryByText(/Selected \(/)).toBeNull()

    for (let i = 2; i < 13; i++) fireEvent.click(songButton(name(i)))
    // Closing after the 11th clears the search box for next time
    expect(screen.queryByRole("dialog")).toBeNull()
    fireEvent.click(screen.getByText("Regular Picks").closest("button")!)
    expect(
      screen.getByText("All 11 regular picks selected!")
    ).toBeInTheDocument()
  })

  it("replaces the picker with the locked panel", () => {
    render(<SongPicker show={show} songs={songs} isLocked />)
    expect(screen.getByText("Picks Are Closed")).toBeInTheDocument()
    expect(screen.queryByText("Opener Pick")).toBeNull()
  })
})

describe("SongPicker drafts", () => {
  it("restores a saved draft once and persists later changes", () => {
    vi.mocked(readPickDraft).mockReturnValue({
      openerPick: pick(5, "OPENER") as never,
      encorePick: null,
      regularPicks: [pick(6, "REGULAR") as never],
    })
    render(
      <SongPicker show={show} songs={songs} isLocked={false} userId="u1" />
    )
    expect(toast.info).toHaveBeenCalledWith(
      "Restored your unsaved picks from last time"
    )
    expect(songButton(name(5))).toHaveAttribute("aria-pressed", "true")
    expect(songButton(name(6))).toHaveAttribute("aria-pressed", "true")
    // The opener section is still the open one, so this replaces the opener
    fireEvent.click(songButton(name(1)))
    expect(writePickDraft).toHaveBeenLastCalledWith(
      "u1",
      "show-1",
      expect.objectContaining({
        openerPick: expect.objectContaining({ songId: "s1" }),
      })
    )
  })

  it("doesn't announce a draft identical to the saved picks", () => {
    vi.mocked(readPickDraft).mockReturnValue({
      openerPick: pick(0, "OPENER") as never,
      encorePick: pick(1, "ENCORE") as never,
      regularPicks: fullPicks().slice(2) as never,
    })
    render(
      <SongPicker
        show={show}
        songs={songs}
        isLocked={false}
        userId="u1"
        existingPicks={fullPicks()}
      />
    )
    expect(toast.info).not.toHaveBeenCalled()
  })

  it("waits for songs to load before restoring", async () => {
    const { rerender } = render(
      <SongPicker show={show} songs={[]} isLocked={false} userId="u1" />
    )
    expect(readPickDraft).not.toHaveBeenCalled()
    expect(writePickDraft).not.toHaveBeenCalled()
    rerender(
      <SongPicker show={show} songs={songs} isLocked={false} userId="u1" />
    )
    await waitFor(() => expect(readPickDraft).toHaveBeenCalledTimes(1))
  })

  it("skips drafts for guests and locked shows", () => {
    render(
      <SongPicker show={show} songs={songs} isLocked guestMode userId="u1" />
    )
    expect(readPickDraft).not.toHaveBeenCalled()
  })
})
