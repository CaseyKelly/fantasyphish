import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"

vi.mock("@/lib/prisma", async () => {
  const { createPrismaMock } = await import("@/test-utils/prisma-mock")
  return { prisma: createPrismaMock() }
})
vi.mock("@/lib/cron-helpers", () => ({ shouldRunCronJobs: vi.fn() }))
vi.mock("@/lib/reminders", () => ({ sendPickReminders: vi.fn() }))

import { prisma } from "@/lib/prisma"
import { shouldRunCronJobs } from "@/lib/cron-helpers"
import { sendPickReminders } from "@/lib/reminders"
import { resetPrismaMock, type PrismaMock } from "@/test-utils/prisma-mock"
import { makeRequest } from "@/test-utils/request"
import { GET, POST } from "./route"

const db = prisma as unknown as PrismaMock
const cronMock = vi.mocked(shouldRunCronJobs)
const remindersMock = vi.mocked(sendPickReminders)

const req = (
  headers: Record<string, string> = { authorization: "Bearer secret" }
) => makeRequest("/api/send-reminders", { method: "POST", headers })

// Noon Mountain Daylight Time
const NOON_MDT = new Date("2025-07-04T18:00:00Z")

beforeEach(() => {
  resetPrismaMock(db)
  cronMock.mockReset()
  cronMock.mockResolvedValue({ shouldRun: true })
  remindersMock.mockReset()
  vi.stubEnv("CRON_SECRET", "secret")
  vi.useFakeTimers({ toFake: ["Date"] })
  vi.setSystemTime(NOON_MDT)
  vi.spyOn(console, "log").mockImplementation(() => {})
  vi.spyOn(console, "error").mockImplementation(() => {})
})

afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllEnvs()
  vi.restoreAllMocks()
})

describe("/api/send-reminders", () => {
  it("rejects a bad secret", async () => {
    expect((await POST(req({ authorization: "Bearer x" }))).status).toBe(401)
  })

  it("no-ops outside noon Mountain time", async () => {
    vi.setSystemTime(new Date("2025-07-04T19:00:00Z"))
    const json = await (await GET(req())).json()
    expect(json).toEqual({
      skipped: true,
      reason: "Not the target Mountain hour",
    })
    expect(remindersMock).not.toHaveBeenCalled()
  })

  it("skips when no tours are active", async () => {
    cronMock.mockResolvedValue({ shouldRun: false, reason: "No active tours" })
    expect((await (await POST(req())).json()).reason).toBe("No active tours")
  })

  it("sends reminders at noon MT", async () => {
    remindersMock.mockResolvedValue({
      showsChecked: 1,
      eligibleUsers: 2,
      sent: 2,
      failed: 0,
      pushSent: 1,
      pushFailed: 0,
      errors: [],
    })
    const json = await (await POST(req())).json()
    expect(json).toMatchObject({ success: true, sent: 2, pushSent: 1 })
    expect(db.$disconnect).toHaveBeenCalled()
  })

  it("returns 500 on failure", async () => {
    remindersMock.mockRejectedValueOnce(new Error("boom"))
    expect((await (await POST(req())).json()).error).toBe("boom")
    remindersMock.mockRejectedValueOnce(1)
    expect((await (await POST(req())).json()).error).toBe("Unknown error")
  })
})
