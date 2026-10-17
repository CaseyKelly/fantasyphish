// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen, fireEvent, act } from "@testing-library/react"
import userEvent from "@testing-library/user-event"

vi.mock("next/navigation", () => ({
  useRouter: vi.fn(),
  useSearchParams: vi.fn(),
}))

import { useRouter, useSearchParams } from "next/navigation"
import { LiveBadge } from "./LiveBadge"
import { Footer } from "./Footer"
import { FeedbackPanel } from "./FeedbackPanel"
import { DonutLogo, DonutLogoWithText } from "./DonutLogo"
import { LoadingDonut } from "./LoadingDonut"
import { TourSelector } from "./TourSelector"
import { AchievementBadge } from "./AchievementBadge"

beforeEach(() => {
  // styled-jsx's <style jsx> isn't compiled under Vitest, so React warns
  // about the unknown `jsx` attribute; that's expected here.
  vi.spyOn(console, "error").mockImplementation(() => {})
})

describe("static components", () => {
  it("LiveBadge", () => {
    render(<LiveBadge />)
    expect(screen.getByText("LIVE")).toBeInTheDocument()
  })

  it("Footer credits phish.net and optionally shows feedback", () => {
    const { rerender } = render(<Footer />)
    expect(screen.getByRole("link", { name: "phish.net" })).toHaveAttribute(
      "href",
      "https://phish.net"
    )
    expect(screen.queryByText("Email Chalupa")).not.toBeInTheDocument()
    rerender(<Footer showFeedback />)
    expect(screen.getByText("Email Chalupa")).toBeInTheDocument()
  })

  it("FeedbackPanel links to a mailto", () => {
    render(<FeedbackPanel className="extra" />)
    expect(screen.getByRole("link")).toHaveAttribute(
      "href",
      expect.stringContaining("mailto:")
    )
  })

  it("DonutLogo sizes and the text variant", () => {
    const { container } = render(
      <>
        <DonutLogo size="xl" className="c" />
        <DonutLogoWithText size="sm" />
      </>
    )
    expect(container.querySelector("svg")?.getAttribute("class")).toContain(
      "w-16"
    )
    expect(screen.getByText("FantasyPhish")).toBeInTheDocument()
  })

  it("LoadingDonut is decorative by default and a status when labeled", () => {
    const { container, rerender } = render(<LoadingDonut size="xs" />)
    expect(container.firstElementChild).toHaveAttribute("aria-hidden", "true")
    rerender(<LoadingDonut label="Loading picks" />)
    expect(screen.getByRole("status")).toHaveTextContent("Loading picks")
  })
})

describe("TourSelector", () => {
  const push = vi.fn()
  const tours = [
    {
      id: "t1",
      name: "Summer",
      startDate: new Date("2025-07-01T12:00:00Z"),
      endDate: null,
    },
  ]

  beforeEach(() => {
    push.mockReset()
    vi.mocked(useRouter).mockReturnValue({ push } as never)
    vi.mocked(useSearchParams).mockReturnValue(
      new URLSearchParams("view=show") as never
    )
  })

  it("sets and clears the tourId param", async () => {
    render(<TourSelector tours={tours} />)
    const select = screen.getByRole("combobox")
    expect(screen.getByText("Summer (2025)")).toBeInTheDocument()

    await userEvent.selectOptions(select, "t1")
    expect(push).toHaveBeenLastCalledWith("/leaderboard?view=show&tourId=t1")

    await userEvent.selectOptions(select, "")
    expect(push).toHaveBeenLastCalledWith("/leaderboard?view=show")
  })

  it("reflects the current tour", () => {
    render(<TourSelector tours={tours} currentTourId="t1" />)
    expect(screen.getByRole("combobox")).toHaveValue("t1")
  })
})

describe("AchievementBadge", () => {
  function rect(r: Partial<DOMRect>): DOMRect {
    return {
      left: 0,
      top: 0,
      width: 0,
      height: 0,
      right: 0,
      bottom: 0,
      x: 0,
      y: 0,
      toJSON: () => ({}),
      ...r,
    }
  }

  it("renders a lucide icon by name or an emoji", () => {
    const { container, rerender } = render(
      <AchievementBadge icon="Trophy" name="Champ" />
    )
    expect(container.querySelector("svg")).not.toBeNull()
    rerender(<AchievementBadge icon="🍩" name="Donut" />)
    expect(screen.getByText("🍩")).toBeInTheDocument()
  })

  it("only shows a tooltip when there is a description", () => {
    render(<AchievementBadge icon="🍩" name="Donut" />)
    fireEvent.mouseEnter(screen.getByText("Donut").closest("div.relative")!)
    expect(screen.queryByText(/./, { selector: ".bg-slate-900" })).toBeNull()
  })

  it("shows, repositions, and dismisses the tooltip", () => {
    const spy = vi
      .spyOn(HTMLElement.prototype, "getBoundingClientRect")
      .mockImplementation(function (this: HTMLElement) {
        // Card hugging the left edge near the top of the viewport
        return this.className.includes("bg-slate-900")
          ? rect({ width: 200, height: 60 })
          : rect({ left: 0, top: 10, width: 100, height: 100 })
      })

    render(<AchievementBadge icon="🍩" name="Donut" description="Ate 20" />)
    const card = screen.getByText("Donut").closest("div.relative")!

    fireEvent.mouseEnter(card)
    const tooltip = screen.getByText("Ate 20")
    // Shifted right to stay on screen, and flipped below the card
    expect(tooltip.style.transform).toContain("translateX(58px)")
    expect(tooltip.className).toContain("top-full")

    act(() => {
      window.dispatchEvent(new Event("resize"))
    })

    fireEvent.pointerDown(card)
    expect(screen.getByText("Ate 20")).toBeInTheDocument()
    fireEvent.pointerDown(document.body)
    expect(screen.queryByText("Ate 20")).not.toBeInTheDocument()

    fireEvent.mouseEnter(card)
    fireEvent.mouseLeave(card)
    expect(screen.queryByText("Ate 20")).not.toBeInTheDocument()
    spy.mockRestore()
  })

  it("shifts left near the right edge and stays above when there's room", () => {
    Object.defineProperty(window, "innerWidth", {
      configurable: true,
      value: 300,
    })
    const spy = vi
      .spyOn(HTMLElement.prototype, "getBoundingClientRect")
      .mockImplementation(function (this: HTMLElement) {
        return this.className.includes("bg-slate-900")
          ? rect({ width: 200, height: 60 })
          : rect({ left: 250, top: 500, width: 50, height: 50 })
      })
    render(<AchievementBadge icon="🍩" name="Donut" description="Tip" />)
    fireEvent.mouseEnter(screen.getByText("Donut").closest("div.relative")!)
    const tooltip = screen.getByText("Tip")
    expect(tooltip.style.transform).toContain("translateX(-83px)")
    expect(tooltip.className).toContain("bottom-full")
    spy.mockRestore()
  })
})
