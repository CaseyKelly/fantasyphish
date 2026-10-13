import { describe, expect, it } from "vitest"
import { isTransientNetworkError } from "./network-error"

describe("isTransientNetworkError", () => {
  it.each([
    "Load failed",
    "Failed to fetch",
    "NetworkError when attempting to fetch resource.",
  ])("matches the browser network-failure TypeError %j", (message) => {
    expect(isTransientNetworkError(new TypeError(message))).toBe(true)
  })

  it("ignores non-TypeErrors with the same message", () => {
    expect(isTransientNetworkError(new Error("Load failed"))).toBe(false)
  })

  it("ignores other TypeErrors", () => {
    expect(
      isTransientNetworkError(
        new TypeError("Cannot read properties of undefined (reading 'id')")
      )
    ).toBe(false)
  })

  it("ignores non-errors", () => {
    expect(isTransientNetworkError("Load failed")).toBe(false)
    expect(isTransientNetworkError(null)).toBe(false)
  })
})
