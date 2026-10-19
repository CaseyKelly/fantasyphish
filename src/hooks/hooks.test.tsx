// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from "vitest"
import { useRef } from "react"
import { render, renderHook, screen, fireEvent } from "@testing-library/react"
import { useFocusTrap } from "./useFocusTrap"
import { useRefetchOnReturn } from "./useRefetchOnReturn"

function setVisibility(state: DocumentVisibilityState) {
  Object.defineProperty(document, "visibilityState", {
    configurable: true,
    get: () => state,
  })
}

afterEach(() => {
  vi.useRealTimers()
  setVisibility("visible")
})

describe("useRefetchOnReturn", () => {
  it("fires on focus and on becoming visible, debounced to once per second", () => {
    vi.useFakeTimers()
    const onReturn = vi.fn()
    renderHook(() => useRefetchOnReturn(onReturn))

    window.dispatchEvent(new Event("focus"))
    setVisibility("visible")
    document.dispatchEvent(new Event("visibilitychange"))
    expect(onReturn).toHaveBeenCalledTimes(1)

    vi.advanceTimersByTime(1001)
    setVisibility("hidden")
    document.dispatchEvent(new Event("visibilitychange"))
    expect(onReturn).toHaveBeenCalledTimes(1)
    setVisibility("visible")
    document.dispatchEvent(new Event("visibilitychange"))
    expect(onReturn).toHaveBeenCalledTimes(2)
  })

  it("uses the latest callback and does nothing when disabled", () => {
    const first = vi.fn()
    const second = vi.fn()
    const { rerender, unmount } = renderHook(
      ({ cb, enabled }) => useRefetchOnReturn(cb, enabled),
      { initialProps: { cb: first, enabled: true } }
    )
    rerender({ cb: second, enabled: true })
    window.dispatchEvent(new Event("focus"))
    expect(first).not.toHaveBeenCalled()
    expect(second).toHaveBeenCalledTimes(1)

    rerender({ cb: second, enabled: false })
    vi.useFakeTimers()
    vi.advanceTimersByTime(2000)
    window.dispatchEvent(new Event("focus"))
    expect(second).toHaveBeenCalledTimes(1)
    unmount()
  })
})

function Modal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const ref = useRef<HTMLDivElement>(null)
  useFocusTrap(ref, open, onClose)
  return (
    <div ref={ref}>
      <button>first</button>
      <button disabled>disabled</button>
      <button>last</button>
    </div>
  )
}

function EmptyModal({ onClose }: { onClose: () => void }) {
  const ref = useRef<HTMLDivElement>(null)
  useFocusTrap(ref, true, onClose)
  return <div ref={ref}>no focusables</div>
}

describe("useFocusTrap", () => {
  it("focuses the first element, wraps Tab in both directions, and closes on Escape", () => {
    const onClose = vi.fn()
    render(<Modal open onClose={onClose} />)
    const first = screen.getByText("first")
    const last = screen.getByText("last")
    expect(first).toHaveFocus()

    fireEvent.keyDown(document, { key: "Tab", shiftKey: true })
    expect(last).toHaveFocus()
    fireEvent.keyDown(document, { key: "Tab" })
    expect(first).toHaveFocus()
    // Tab from a middle element is left to the browser
    fireEvent.keyDown(document, { key: "a" })
    fireEvent.keyDown(document, { key: "Escape" })
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it("restores focus to the previously focused element on close", () => {
    const outside = document.createElement("button")
    document.body.appendChild(outside)
    outside.focus()
    const { rerender } = render(<Modal open onClose={() => {}} />)
    expect(outside).not.toHaveFocus()
    rerender(<Modal open={false} onClose={() => {}} />)
    expect(outside).toHaveFocus()
    outside.remove()
  })

  it("does nothing while closed and tolerates no focusable children", () => {
    const onClose = vi.fn()
    render(<Modal open={false} onClose={onClose} />)
    fireEvent.keyDown(document, { key: "Escape" })
    expect(onClose).not.toHaveBeenCalled()

    render(<EmptyModal onClose={onClose} />)
    fireEvent.keyDown(document, { key: "Tab" })
    fireEvent.keyDown(document, { key: "Escape" })
    expect(onClose).toHaveBeenCalledTimes(1)
  })
})
