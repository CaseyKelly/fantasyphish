import { vi, type Mock } from "vitest"

export interface CheckIn {
  slug: string
  status: "ok" | "error"
}

export interface SentryMock {
  withMonitor: Mock
  flush: Mock
  checkIns: CheckIn[]
}

/**
 * Stand-in for `@sentry/nextjs` cron monitoring. `withMonitor` behaves like
 * the real one (runs the callback, reports "error" if it throws and "ok"
 * otherwise) and records each finished check-in in `checkIns`.
 *
 * Usage (vi.mock is hoisted, so build the mock inside the factory):
 *
 *   vi.mock("@sentry/nextjs", async () => {
 *     const { createSentryMock } = await import("@/test-utils/sentry-mock")
 *     return createSentryMock()
 *   })
 *   import * as Sentry from "@sentry/nextjs"
 *   const sentry = Sentry as unknown as SentryMock
 *
 * Call `resetSentryMock(sentry)` in beforeEach.
 */
export function createSentryMock(): SentryMock {
  const checkIns: CheckIn[] = []
  const withMonitor = vi.fn(
    async (slug: string, callback: () => Promise<unknown>) => {
      try {
        const result = await callback()
        checkIns.push({ slug, status: "ok" })
        return result
      } catch (error) {
        checkIns.push({ slug, status: "error" })
        throw error
      }
    }
  )
  return { withMonitor, flush: vi.fn(async () => true), checkIns }
}

export function resetSentryMock(sentry: SentryMock): void {
  sentry.checkIns.length = 0
  sentry.withMonitor.mockClear()
  sentry.flush.mockClear()
}
