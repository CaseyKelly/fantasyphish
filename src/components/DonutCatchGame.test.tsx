// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { render, screen, fireEvent, act, waitFor } from "@testing-library/react"

vi.mock("next-auth/react", () => ({ useSession: vi.fn() }))

import { useSession } from "next-auth/react"
import { DonutCatchGame } from "./DonutCatchGame"

const fetchMock = vi.fn()
let rafCallback: FrameRequestCallback | null = null
let now = 0
let random: ReturnType<typeof vi.spyOn>

// Every CanvasRenderingContext2D method/property the game touches is a no-op
const ctx = new Proxy({} as Record<string | symbol, unknown>, {
  get: (target, prop) => (prop in target ? target[prop] : () => {}),
  set: (target, prop, value) => {
    target[prop] = value
    return true
  },
})

function json(body: unknown, ok = true) {
  return { ok, json: async () => body }
}

/** Advance the game loop by `count` 50ms frames. */
function frames(count: number) {
  act(() => {
    for (let i = 0; i < count; i++) {
      const cb = rafCallback
      if (!cb) return
      now += 50
      cb(now)
    }
  })
}

function framesUntil(predicate: () => boolean, max = 2000) {
  for (let i = 0; i < max && !predicate(); i++) frames(1)
}

const canvas = () => document.querySelector("canvas")!
const scoreText = () =>
  Number(screen.getByText(/^Score:/).querySelector("span")!.textContent)

beforeEach(() => {
  vi.clearAllMocks()
  now = 0
  rafCallback = null
  vi.stubGlobal("fetch", fetchMock)
  vi.stubGlobal("requestAnimationFrame", (cb: FrameRequestCallback) => {
    rafCallback = cb
    return 1
  })
  vi.stubGlobal("cancelAnimationFrame", vi.fn())
  HTMLCanvasElement.prototype.getContext = vi.fn(() => ctx) as never
  HTMLCanvasElement.prototype.getBoundingClientRect = () =>
    ({ left: 0, top: 0, width: 360, height: 480 }) as DOMRect
  random = vi.spyOn(Math, "random").mockReturnValue(0.5)
  window.localStorage.clear()
  vi.mocked(useSession).mockReturnValue({
    data: { user: { username: "alice" } },
    status: "authenticated",
  } as never)
  fetchMock.mockResolvedValue(json({ leaderboard: [], yourBest: null }))
})

afterEach(() => {
  vi.unstubAllGlobals()
  random.mockRestore()
})

describe("DonutCatchGame", () => {
  it("loads the leaderboard and best score, highlighting the current user", async () => {
    window.localStorage.setItem("fantasyphish_donut_catch_best", "4")
    fetchMock.mockResolvedValue(
      json({
        leaderboard: [
          { username: "bob", score: 30 },
          { username: "alice", score: 12 },
        ],
        yourBest: 12,
      })
    )
    render(<DonutCatchGame />)
    expect(await screen.findByText("bob")).toBeInTheDocument()
    expect(screen.getByText("alice").closest("li")!.className).toContain(
      "text-white"
    )
    expect(screen.getByText(/^Best:/)).toHaveTextContent("Best: 12")
    expect(screen.getByText("Donut Catch")).toBeInTheDocument()
  })

  it("handles a failed or malformed leaderboard response", async () => {
    vi.mocked(useSession).mockReturnValue({
      data: null,
      status: "unauthenticated",
    } as never)
    fetchMock
      .mockResolvedValueOnce(json({}, false))
      .mockResolvedValueOnce(json({ leaderboard: "nope" }))
      .mockRejectedValueOnce(new Error("offline"))
    render(<DonutCatchGame />)
    render(<DonutCatchGame />)
    render(<DonutCatchGame />)
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(3))
    expect(screen.getAllByText("Log in to save your score")).toHaveLength(3)
    expect(screen.getAllByText("No scores yet — be the first!")).toHaveLength(3)
  })

  it("does nothing without a 2D context", () => {
    HTMLCanvasElement.prototype.getContext = vi.fn(() => null) as never
    render(<DonutCatchGame />)
    expect(rafCallback).toBeNull()
  })

  it("plays a full game: catches, a Type II jam, misses, and game over", async () => {
    fetchMock
      .mockResolvedValueOnce(json({ leaderboard: [], yourBest: null }))
      .mockResolvedValueOnce(
        json({ isNewBest: true, achievementAwarded: true })
      )
      .mockResolvedValueOnce(
        json({ leaderboard: [{ username: "alice", score: 99 }], yourBest: 99 })
      )
    const { unmount } = render(<DonutCatchGame />)
    // Idle frames just redraw
    frames(5)
    fireEvent.click(screen.getByRole("button", { name: "Start" }))
    expect(screen.queryByText("Donut Catch")).toBeNull()

    // Donuts spawn at the center, right above the basket: 8 in a row starts a jam
    framesUntil(() => screen.queryByText(/Type II Jam/) !== null)
    expect(scoreText()).toBe(8)
    // Jam catches are worth 2
    framesUntil(() => scoreText() >= 10)
    expect(scoreText() % 2).toBe(0)
    // The jam (and its banner) ends after 6 seconds
    framesUntil(() => screen.queryByText(/Type II Jam/) === null)

    // Now spawn at the far left and park the basket far right: every donut drops
    random.mockReturnValue(0.99)
    fireEvent.pointerMove(canvas(), { clientX: 10 })
    fireEvent.keyDown(window, { key: "ArrowLeft" })
    frames(20)
    fireEvent.keyUp(window, { key: "ArrowLeft" })
    framesUntil(() => screen.queryByText("Show's over!") !== null)

    expect(screen.getByText(/^Lives:/)).toHaveTextContent("Lives:")
    const finalScore = scoreText()
    expect(window.localStorage.getItem("fantasyphish_donut_catch_best")).toBe(
      String(finalScore)
    )
    const post = fetchMock.mock.calls.find((c) => c[1]?.method === "POST")!
    expect(JSON.parse(post[1].body)).toEqual({ score: finalScore })
    expect(await screen.findByText("🎉 New high score!")).toBeInTheDocument()
    expect(
      screen.getByText("🏆 Achievement unlocked: Donut Devotee!")
    ).toBeInTheDocument()
    await waitFor(() =>
      expect(screen.getByText(/^Best:/)).toHaveTextContent("Best: 99")
    )

    // Space restarts from game over
    fireEvent.keyDown(window, { key: " " })
    expect(screen.queryByText("Show's over!")).toBeNull()
    fireEvent.keyDown(window, { key: " " })
    unmount()
  })

  it("catches a wobbling Harpua bonus donut for 5 points", () => {
    render(<DonutCatchGame />)
    fireEvent.pointerDown(canvas())
    framesUntil(() => scoreText() >= 3)
    // The next spawn's bonus roll succeeds; it still drops at the center
    random.mockReturnValueOnce(0.01)
    const before = scoreText()
    framesUntil(() => screen.queryByText(/Harpua! \+5/) !== null)
    expect(screen.getByText("🐈 Harpua! +5")).toBeInTheDocument()
    expect(scoreText() - before).toBeGreaterThanOrEqual(5)
    // The banner clears after 1.4 seconds
    framesUntil(() => screen.queryByText(/Harpua!/) === null, 100)
    expect(screen.queryByText(/Harpua!/)).toBeNull()
  })

  it("doesn't submit a zero score or scores while signed out", () => {
    vi.mocked(useSession).mockReturnValue({
      data: null,
      status: "unauthenticated",
    } as never)
    random.mockReturnValue(0.99)
    render(<DonutCatchGame />)
    fireEvent.pointerDown(canvas())
    // Pointer down mid-game does nothing
    fireEvent.pointerDown(canvas())
    fireEvent.pointerMove(canvas(), { clientX: 0 })
    framesUntil(() => screen.queryByText("Show's over!") !== null)
    expect(
      screen.getByText(/You caught 0 donuts|0 donuts deep|wrap on 0 donuts/)
    ).toBeInTheDocument()
    expect(fetchMock.mock.calls.some((c) => c[1]?.method === "POST")).toBe(
      false
    )
    expect(
      screen.getByRole("button", { name: "Play Again" })
    ).toBeInTheDocument()
  })

  it("ignores a failed score submission", async () => {
    fetchMock
      .mockResolvedValueOnce(json({ leaderboard: [] }))
      .mockResolvedValueOnce(json({}, false))
    render(<DonutCatchGame />)
    fireEvent.click(screen.getByRole("button", { name: "Start" }))
    framesUntil(() => scoreText() >= 1)
    random.mockReturnValue(0.99)
    fireEvent.pointerMove(canvas(), { clientX: 0 })
    framesUntil(() => screen.queryByText("Show's over!") !== null)
    await waitFor(() =>
      expect(fetchMock.mock.calls.some((c) => c[1]?.method === "POST")).toBe(
        true
      )
    )
    expect(screen.queryByText("🎉 New high score!")).toBeNull()
  })
})
