import { describe, it, expect, vi, afterEach } from "vitest"

vi.mock("@sentry/nextjs", () => ({
  init: vi.fn(),
  captureRequestError: vi.fn(),
  captureRouterTransitionStart: vi.fn(),
}))

import * as Sentry from "@sentry/nextjs"

afterEach(() => {
  vi.unstubAllEnvs()
  vi.mocked(Sentry.init).mockClear()
})

describe("server instrumentation", () => {
  it.each(["nodejs", "edge"])(
    "initializes Sentry in the %s runtime",
    async (runtime) => {
      vi.stubEnv("NEXT_RUNTIME", runtime)
      vi.stubEnv("NEXT_PUBLIC_SENTRY_DSN", "https://dsn")
      const { register, onRequestError } = await import("./instrumentation")
      register()
      expect(Sentry.init).toHaveBeenCalledWith(
        expect.objectContaining({ dsn: "https://dsn", tracesSampleRate: 0 })
      )
      expect(onRequestError).toBe(Sentry.captureRequestError)
    }
  )

  it("does nothing in other runtimes", async () => {
    vi.stubEnv("NEXT_RUNTIME", "")
    const { register } = await import("./instrumentation")
    register()
    expect(Sentry.init).not.toHaveBeenCalled()
  })
})

describe("client instrumentation", () => {
  it("initializes Sentry with noise filters and drops Google renderer noise", async () => {
    const mod = await import("./instrumentation-client")
    expect(mod.onRouterTransitionStart).toBe(
      Sentry.captureRouterTransitionStart
    )
    const config = vi.mocked(Sentry.init).mock.calls[0][0]!
    expect(config.ignoreErrors?.length).toBeGreaterThan(0)
    const event = { exception: { values: [] } }
    expect(config.beforeSend?.(event as never, {})).toBe(event)
  })
})
