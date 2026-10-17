// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { render, screen, fireEvent, act } from "@testing-library/react"

vi.mock("next/navigation", () => ({ useRouter: vi.fn() }))
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }))
vi.mock("@/lib/auth-client", () => ({ signInWithRetry: vi.fn() }))
vi.mock("./DonutCatchGame", () => ({
  DonutCatchGame: () => <div>donut game</div>,
}))

import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { signInWithRetry } from "@/lib/auth-client"
import { GuestRegistrationModal } from "./GuestRegistrationModal"
import { EasterEgg } from "./EasterEgg"
import { SortableTable, type Column } from "./admin/SortableTable"

const push = vi.fn()
const refresh = vi.fn()
const fetchMock = vi.fn()

function json(body: unknown, ok = true) {
  return { ok, json: async () => body }
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(useRouter).mockReturnValue({ push, refresh } as never)
  vi.stubGlobal("fetch", fetchMock)
  vi.spyOn(console, "error").mockImplementation(() => {})
})

afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllGlobals()
})

describe("GuestRegistrationModal", () => {
  const picks = [
    { songId: "s1", songName: "Tweezer", pickType: "OPENER" as const },
  ]

  function renderModal(onClose = vi.fn()) {
    render(
      <GuestRegistrationModal showId="show-1" picks={picks} onClose={onClose} />
    )
    return onClose
  }

  function fillRegister(password = "password1", confirm = password) {
    fireEvent.change(screen.getByLabelText("Email"), {
      target: { value: "a@b.com" },
    })
    fireEvent.change(screen.getByLabelText("Username"), {
      target: { value: "alice" },
    })
    fireEvent.change(screen.getByLabelText("Password"), {
      target: { value: password },
    })
    fireEvent.change(screen.getByLabelText("Confirm Password"), {
      target: { value: confirm },
    })
  }

  const submitRegister = () =>
    act(async () => {
      fireEvent.click(
        screen.getByRole("button", { name: "Create Account & Submit Picks" })
      )
    })

  it("locks background scroll and closes", () => {
    const onClose = renderModal()
    expect(document.body.style.overflow).toBe("hidden")
    fireEvent.click(screen.getByRole("button", { name: "Close" }))
    expect(onClose).toHaveBeenCalled()
  })

  it("validates passwords before registering", async () => {
    renderModal()
    fillRegister("password1", "password2")
    await submitRegister()
    expect(toast.error).toHaveBeenLastCalledWith("Passwords do not match")
    fillRegister("short")
    await submitRegister()
    expect(toast.error).toHaveBeenLastCalledWith(
      "Password must be at least 8 characters"
    )
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it("registers with picks and redirects to login", async () => {
    fetchMock.mockResolvedValue(json({ success: true }))
    renderModal()
    fillRegister()
    await submitRegister()
    const body = JSON.parse(fetchMock.mock.calls[0][1].body)
    expect(body).toMatchObject({
      email: "a@b.com",
      username: "alice",
      showId: "show-1",
      picks: [{ songId: "s1", pickType: "OPENER" }],
    })
    expect(push).toHaveBeenCalledWith("/login?registered=true")
  })

  it("shows registration errors", async () => {
    fetchMock
      .mockResolvedValueOnce(json({ error: "Email taken" }, false))
      .mockResolvedValueOnce(json({}, false))
      .mockRejectedValueOnce(new Error("offline"))
    renderModal()
    fillRegister()
    await submitRegister()
    expect(toast.error).toHaveBeenLastCalledWith("Email taken")
    await submitRegister()
    expect(toast.error).toHaveBeenLastCalledWith("Failed to create account")
    await submitRegister()
    expect(toast.error).toHaveBeenLastCalledWith("An unexpected error occurred")
  })

  describe("sign-in mode", () => {
    function switchToSignIn() {
      fireEvent.click(screen.getByText("Already have an account? Sign in"))
      fireEvent.change(screen.getByLabelText("Email"), {
        target: { value: "a@b.com" },
      })
      fireEvent.change(screen.getByLabelText("Password"), {
        target: { value: "pw" },
      })
    }
    const submit = () =>
      act(async () => {
        fireEvent.click(
          screen.getByRole("button", { name: "Sign In & Save Picks" })
        )
      })

    it("switches modes both ways", () => {
      renderModal()
      switchToSignIn()
      expect(screen.getByText("Sign In to Save Picks")).toBeInTheDocument()
      fireEvent.click(screen.getByText("Don't have an account? Create one"))
      expect(screen.getByText("Create Your Account")).toBeInTheDocument()
    })

    it.each([
      [{ exists: false }, "No account found with this email"],
      [
        { exists: true, verified: false },
        "Please verify your email before logging in",
      ],
    ])("rejects %o", async (check, message) => {
      fetchMock.mockResolvedValue(json(check))
      renderModal()
      switchToSignIn()
      await submit()
      expect(toast.error).toHaveBeenCalledWith(message)
      expect(signInWithRetry).not.toHaveBeenCalled()
    })

    it("reports a wrong password", async () => {
      fetchMock.mockResolvedValue(json({ exists: true, verified: true }))
      vi.mocked(signInWithRetry).mockResolvedValue({ error: "x" } as never)
      renderModal()
      switchToSignIn()
      await submit()
      expect(toast.error).toHaveBeenCalledWith("Incorrect password")
    })

    it("signs in and saves picks", async () => {
      fetchMock
        .mockResolvedValueOnce(json({ exists: true, verified: true }))
        .mockResolvedValueOnce(json({ isUpdate: false }))
        .mockResolvedValueOnce(json({ exists: true, verified: true }))
        .mockResolvedValueOnce(json({ isUpdate: true }))
      vi.mocked(signInWithRetry).mockResolvedValue({ ok: true } as never)
      renderModal()
      switchToSignIn()
      await submit()
      expect(toast.success).toHaveBeenLastCalledWith(
        "Picks saved successfully!"
      )
      expect(push).toHaveBeenCalledWith("/picks")
      await submit()
      expect(toast.success).toHaveBeenLastCalledWith(
        "Picks updated successfully!"
      )
    })

    it("reports pick save failures and unexpected errors", async () => {
      fetchMock
        .mockResolvedValueOnce(json({ exists: true, verified: true }))
        .mockResolvedValueOnce(json({}, false))
        .mockRejectedValueOnce(new Error("offline"))
      vi.mocked(signInWithRetry).mockResolvedValue(undefined as never)
      renderModal()
      switchToSignIn()
      await submit()
      expect(toast.error).toHaveBeenLastCalledWith("Failed to save picks")
      await submit()
      expect(toast.error).toHaveBeenLastCalledWith(
        "An unexpected error occurred"
      )
    })
  })
})

describe("EasterEgg", () => {
  const press = (...keys: string[]) =>
    keys.forEach((key) => fireEvent.keyDown(window, { key }))
  const konami = [
    "ArrowUp",
    "ArrowUp",
    "ArrowDown",
    "ArrowDown",
    "ArrowLeft",
    "ArrowRight",
    "ArrowLeft",
    "ArrowRight",
    "B",
    "a",
  ]

  it("opens on the Konami code and closes with Escape or the button", () => {
    render(<EasterEgg />)
    press(...konami)
    expect(screen.getByText("donut game")).toBeInTheDocument()
    // Keys are ignored while open
    press(...konami)
    press("Escape")
    expect(screen.queryByText("donut game")).toBeNull()

    press(...konami)
    fireEvent.click(screen.getByRole("button", { name: "Close game" }))
    expect(screen.queryByText("donut game")).toBeNull()
  })

  it("restarts on a wrong key, counting a fresh Up as progress", () => {
    render(<EasterEgg />)
    press("ArrowUp", "ArrowDown", "Shift")
    expect(screen.queryByText("donut game")).toBeNull()
    // "Up" after a mismatch counts as the first step
    press("ArrowUp", ...konami.slice(1))
    expect(screen.getByText("donut game")).toBeInTheDocument()
  })

  it("ignores keys typed into inputs", () => {
    render(
      <>
        <input aria-label="field" />
        <EasterEgg />
      </>
    )
    const input = screen.getByLabelText("field")
    konami.forEach((key) => fireEvent.keyDown(input, { key }))
    expect(screen.queryByText("donut game")).toBeNull()
  })

  it("opens after 5 quick taps on the hidden dot, resetting slow taps", () => {
    vi.useFakeTimers({ toFake: ["Date"] })
    const vibrate = vi.fn()
    Object.defineProperty(navigator, "vibrate", {
      configurable: true,
      value: vibrate,
    })
    const { container } = render(<EasterEgg />)
    const dot = () => container.querySelector("button")!

    fireEvent.click(dot())
    fireEvent.click(dot())
    vi.advanceTimersByTime(2000)
    for (let i = 0; i < 4; i++) fireEvent.click(dot())
    expect(screen.queryByText("donut game")).toBeNull()
    fireEvent.click(dot())
    expect(screen.getByText("donut game")).toBeInTheDocument()
    expect(vibrate).toHaveBeenCalled()

    // vibrate throwing is swallowed
    fireEvent.click(screen.getByRole("button", { name: "Close game" }))
    vibrate.mockImplementation(() => {
      throw new Error("unsupported")
    })
    expect(() => fireEvent.click(dot())).not.toThrow()
    delete (navigator as unknown as Record<string, unknown>).vibrate
  })
})

describe("SortableTable", () => {
  interface Row {
    id: string
    name: string
    score: number | null
  }
  const rows: Row[] = [
    { id: "1", name: "bob", score: 5 },
    { id: "2", name: "alice", score: null },
    { id: "3", name: "carol", score: 9 },
    { id: "4", name: "dave", score: null },
  ]
  const columns: Column<Row>[] = [
    { key: "name", header: "Name", sortable: true },
    { key: "score", header: "Score", sortable: true, align: "right" },
    {
      key: "label",
      header: "Label",
      align: "center",
      render: (r) => <em>{r.name.toUpperCase()}</em>,
    },
    { key: "missing", header: "Missing" },
    {
      key: "double",
      header: "Double",
      accessor: (r) => (r.score === null ? null : r.score * 2),
    },
  ]

  const names = () =>
    screen
      .getAllByRole("row")
      .slice(1)
      .map((r) => r.querySelector("td")!.textContent)

  it("shows an empty message", () => {
    render(<SortableTable columns={columns} rows={[]} rowKey={(r) => r.id} />)
    expect(screen.getByText("No data")).toBeInTheDocument()
  })

  it("renders unsorted with fallbacks for missing values", () => {
    render(<SortableTable columns={columns} rows={rows} rowKey={(r) => r.id} />)
    expect(names()).toEqual(["bob", "alice", "carol", "dave"])
    expect(screen.getByText("BOB")).toBeInTheDocument()
    expect(screen.getAllByText("—").length).toBeGreaterThan(0)
    expect(screen.getByText("10")).toBeInTheDocument()
  })

  it("sorts numbers with nulls last, toggles direction, and sorts strings", () => {
    render(
      <SortableTable
        columns={columns}
        rows={rows}
        rowKey={(r) => r.id}
        initialSortKey="score"
      />
    )
    expect(names()).toEqual(["carol", "bob", "alice", "dave"])
    const score = screen.getByRole("button", { name: /Score/ })
    expect(score).toHaveAttribute("aria-sort", "descending")
    fireEvent.click(score)
    expect(names()).toEqual(["bob", "carol", "alice", "dave"])
    expect(score).toHaveAttribute("aria-sort", "ascending")

    const name = screen.getByRole("button", { name: /Name/ })
    fireEvent.keyDown(name, { key: "Enter" })
    expect(names()).toEqual(["dave", "carol", "bob", "alice"])
    fireEvent.keyDown(name, { key: " " })
    expect(names()).toEqual(["alice", "bob", "carol", "dave"])
    fireEvent.keyDown(name, { key: "x" })

    // Non-sortable headers ignore clicks and keys
    fireEvent.click(screen.getByText("Label"))
    fireEvent.keyDown(screen.getByText("Label"), { key: "Enter" })
    expect(names()).toEqual(["alice", "bob", "carol", "dave"])
  })

  it("ignores an unknown initial sort key", () => {
    render(
      <SortableTable
        columns={columns}
        rows={rows}
        rowKey={(r) => r.id}
        initialSortKey="nope"
      />
    )
    expect(names()).toEqual(["bob", "alice", "carol", "dave"])
  })

  it("truncates to maxRows until expanded", () => {
    render(
      <SortableTable
        columns={columns}
        rows={rows}
        rowKey={(r) => r.id}
        maxRows={2}
        emptyMessage="none"
      />
    )
    expect(names()).toHaveLength(2)
    fireEvent.click(screen.getByText("Show all 4 (showing 2)"))
    expect(names()).toHaveLength(4)
    fireEvent.click(screen.getByText("Show fewer"))
    expect(names()).toHaveLength(2)
  })
})
