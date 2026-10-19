import { describe, it, expect, vi, beforeEach } from "vitest"

vi.mock("@/lib/prisma", async () => {
  const { createPrismaMock } = await import("@/test-utils/prisma-mock")
  return { prisma: createPrismaMock() }
})
vi.mock("@/lib/email", () => ({ sendShowReminderEmail: vi.fn() }))
vi.mock("@/lib/push", () => ({ sendPushNotification: vi.fn() }))
vi.mock("@/lib/streaks", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/streaks")>()),
  getStreaksForUsers: vi.fn(),
}))

import { prisma } from "@/lib/prisma"
import { sendShowReminderEmail } from "@/lib/email"
import { sendPushNotification } from "@/lib/push"
import { getStreaksForUsers } from "@/lib/streaks"
import { resetPrismaMock, type PrismaMock } from "@/test-utils/prisma-mock"
import { sendPickReminders } from "./reminders"

const db = prisma as unknown as PrismaMock
const emailMock = vi.mocked(sendShowReminderEmail)
const pushMock = vi.mocked(sendPushNotification)
const streaksMock = vi.mocked(getStreaksForUsers)

const show = {
  id: "show-1",
  venue: "MSG",
  city: "New York",
  state: "NY",
  showDate: new Date("2025-07-04T00:00:00Z"),
  lockTime: new Date("2025-07-04T23:00:00Z"),
  timezone: "America/New_York",
}

const sub = { id: "ps-1", endpoint: "e", p256dh: "p", auth: "a" }

beforeEach(() => {
  resetPrismaMock(db)
  emailMock.mockReset()
  pushMock.mockReset()
  streaksMock.mockReset()
  streaksMock.mockResolvedValue(new Map())
})

describe("sendPickReminders", () => {
  it("returns zero counts when there are no shows today", async () => {
    db.show.findMany.mockResolvedValue([])
    expect(await sendPickReminders()).toEqual({
      showsChecked: 0,
      eligibleUsers: 0,
      sent: 0,
      failed: 0,
      pushSent: 0,
      pushFailed: 0,
      errors: [],
    })
  })

  it("emails opted-in verified users and pushes to subscribed devices", async () => {
    db.show.findMany.mockResolvedValue([show])
    db.user.findMany.mockResolvedValue([
      {
        id: "u1",
        email: "a@x.com",
        emailPickReminders: true,
        emailVerified: new Date(),
        pushSubscriptions: [sub],
      },
      {
        id: "u2",
        email: "b@x.com",
        emailPickReminders: false,
        emailVerified: null,
        pushSubscriptions: [sub],
      },
    ])
    streaksMock.mockResolvedValue(
      new Map([
        ["u1", { current: 4, best: 4 }],
        ["u2", { current: 1, best: 2 }],
      ])
    )
    emailMock.mockResolvedValue({ success: true })
    pushMock.mockResolvedValue({ success: true, expired: false })

    const result = await sendPickReminders()

    expect(result).toMatchObject({
      showsChecked: 1,
      eligibleUsers: 2,
      sent: 1,
      pushSent: 2,
    })
    expect(emailMock).toHaveBeenCalledTimes(1)
    expect(emailMock.mock.calls[0][1].streakAtRisk).toBe(4)
    expect(pushMock.mock.calls[0][1].title).toContain("4-show streak")
    expect(pushMock.mock.calls[1][1]).toEqual({
      title: "Show tonight — pick your setlist",
      body: "You haven't submitted picks for MSG yet.",
      url: "/pick/show-1",
    })
  })

  it("records failures and deletes expired push subscriptions", async () => {
    db.show.findMany.mockResolvedValue([{ ...show, lockTime: null }])
    db.user.findMany.mockResolvedValue([
      {
        id: "u1",
        email: "a@x.com",
        emailPickReminders: true,
        emailVerified: new Date(),
        pushSubscriptions: [sub, { ...sub, id: "ps-2" }],
      },
    ])
    emailMock.mockResolvedValue({ success: false, error: "bounce" })
    pushMock
      .mockResolvedValueOnce({ success: false, expired: true, error: "gone" })
      .mockResolvedValueOnce({ success: false, expired: false, error: "500" })

    const result = await sendPickReminders()

    expect(result).toMatchObject({ failed: 1, pushFailed: 2 })
    expect(result.errors).toEqual([
      "a@x.com: bounce",
      "a@x.com (push): gone",
      "a@x.com (push): 500",
    ])
    expect(db.pushSubscription.delete).toHaveBeenCalledTimes(1)
    expect(db.pushSubscription.delete).toHaveBeenCalledWith({
      where: { id: "ps-1" },
    })
    // lockTime falls back to showDate
    expect(emailMock.mock.calls[0][1].lockTime).toEqual(show.showDate)
  })

  it("skips streak lookups for test venues and scopes dry runs to one user", async () => {
    db.show.findMany.mockResolvedValue([{ ...show, venue: "Test Venue 1" }])
    db.user.findMany.mockResolvedValue([])

    await sendPickReminders({ dryRunUserId: "u9" })

    expect(streaksMock).not.toHaveBeenCalled()
    expect(db.user.findMany.mock.calls[0][0].where.id).toBe("u9")
  })
})
