import { describe, expect, it } from "vitest"
import { isGoogleRendererNoise } from "./sentry"

function eventWithFrames(functions: string[]) {
  return {
    type: undefined,
    exception: {
      values: [
        {
          type: "Error",
          value: "Rejected",
          stacktrace: { frames: functions.map((fn) => ({ function: fn })) },
        },
      ],
    },
  }
}

describe("isGoogleRendererNoise", () => {
  it("matches the rejection thrown by Googlebot's stubbed SW register", () => {
    expect(
      isGoogleRendererNoise(
        eventWithFrames([
          "d._registerScript",
          "wrsParams.serviceWorkers.navigator.serviceWorker.register",
        ])
      )
    ).toBe(true)
  })

  it("keeps real service worker registration failures", () => {
    expect(
      isGoogleRendererNoise(
        eventWithFrames(["d.register", "d._registerScript"])
      )
    ).toBe(false)
  })

  it("keeps events without a stacktrace", () => {
    expect(isGoogleRendererNoise({ type: undefined })).toBe(false)
  })
})
