// @vitest-environment jsdom
import { describe, it, expect, vi } from "vitest"
import { render, screen } from "@testing-library/react"

vi.mock("next-auth/react", () => ({
  SessionProvider: ({ children }: { children: React.ReactNode }) => (
    <>{children}</>
  ),
}))
vi.mock("sonner", () => ({ Toaster: () => <div>toaster</div> }))
vi.mock("@serwist/turbopack/react", () => ({
  SerwistProvider: ({
    children,
    swUrl,
    disable,
  }: {
    children: React.ReactNode
    swUrl: string
    disable: boolean
  }) => (
    <div data-sw={swUrl} data-disabled={String(disable)}>
      {children}
    </div>
  ),
}))
vi.mock("@/components/EasterEgg", () => ({ EasterEgg: () => <div>egg</div> }))
vi.mock("@/components/ScrollToTop", () => ({ ScrollToTop: () => null }))
vi.mock("@/components/ServiceWorkerUpdater", () => ({
  ServiceWorkerUpdater: () => null,
}))
vi.mock("@/components/ClearAppBadge", () => ({ ClearAppBadge: () => null }))

import { Providers } from "./Providers"

describe("Providers", () => {
  it("wraps the app with the service worker, session, toaster, and easter egg", () => {
    const { container } = render(
      <Providers>
        <p>app</p>
      </Providers>
    )
    expect(screen.getByText("app")).toBeInTheDocument()
    expect(screen.getByText("toaster")).toBeInTheDocument()
    expect(screen.getByText("egg")).toBeInTheDocument()
    const sw = container.querySelector("[data-sw]")!
    expect(sw.getAttribute("data-sw")).toBe("/serwist/sw.js")
    expect(sw.getAttribute("data-disabled")).toBe("false")
  })
})
