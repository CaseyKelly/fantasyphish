import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"

vi.mock("web-push", () => ({
  default: { setVapidDetails: vi.fn(), sendNotification: vi.fn() },
}))

import webpush from "web-push"

const sub = { endpoint: "https://push.example/1", p256dh: "p", auth: "a" }
const payload = { title: "T", body: "B", url: "/x" }

// push.ts caches whether VAPID has been configured at module scope, so each
// test re-imports it fresh.
async function loadPush() {
  vi.resetModules()
  return import("./push")
}

beforeEach(() => {
  vi.mocked(webpush.setVapidDetails).mockReset()
  vi.mocked(webpush.sendNotification).mockReset()
})

afterEach(() => {
  vi.unstubAllEnvs()
})

function stubVapid() {
  vi.stubEnv("VAPID_SUBJECT", "mailto:x@y.com")
  vi.stubEnv("VAPID_PUBLIC_KEY", "pub")
  vi.stubEnv("VAPID_PRIVATE_KEY", "priv")
}

describe("sendPushNotification", () => {
  it("fails without VAPID config", async () => {
    vi.stubEnv("VAPID_SUBJECT", "")
    const { sendPushNotification } = await loadPush()
    const result = await sendPushNotification(sub, payload)
    expect(result.success).toBe(false)
    expect(result.expired).toBe(false)
    expect(result.error).toContain("VAPID")
  })

  it("configures VAPID once and sends the JSON payload", async () => {
    stubVapid()
    const { sendPushNotification } = await loadPush()
    vi.mocked(webpush.sendNotification).mockResolvedValue({} as never)

    expect(await sendPushNotification(sub, payload)).toEqual({
      success: true,
      expired: false,
    })
    await sendPushNotification(sub, payload)

    expect(webpush.setVapidDetails).toHaveBeenCalledTimes(1)
    expect(webpush.sendNotification).toHaveBeenCalledWith(
      { endpoint: sub.endpoint, keys: { p256dh: "p", auth: "a" } },
      JSON.stringify(payload)
    )
  })

  it.each([
    [404, true],
    [410, true],
    [500, false],
  ])("status %d -> expired=%s", async (statusCode, expired) => {
    stubVapid()
    const { sendPushNotification } = await loadPush()
    vi.mocked(webpush.sendNotification).mockRejectedValue(
      Object.assign(new Error("push failed"), { statusCode })
    )
    const result = await sendPushNotification(sub, payload)
    expect(result).toMatchObject({ success: false, expired })
  })
})
