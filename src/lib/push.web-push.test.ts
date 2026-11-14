import { createECDH, randomBytes } from "node:crypto"
import { describe, it, expect } from "vitest"
import * as webpush from "web-push"

// push.test.ts mocks web-push, so it can't catch a release that changes the
// module's shape (v4 dropped the default export). This runs the real package,
// without network access, to check the API push.ts relies on still works.
describe("web-push (real module)", () => {
  it("exports the functions push.ts calls", () => {
    expect(typeof webpush.setVapidDetails).toBe("function")
    expect(typeof webpush.sendNotification).toBe("function")
  })

  it("signs and encrypts a request with the configured VAPID keys", () => {
    const vapid = webpush.generateVAPIDKeys()
    webpush.setVapidDetails(
      "mailto:test@example.com",
      vapid.publicKey,
      vapid.privateKey
    )

    const browserKey = createECDH("prime256v1")
    browserKey.generateKeys()
    const subscription = {
      endpoint: "https://push.example.com/send/abc",
      keys: {
        p256dh: browserKey.getPublicKey().toString("base64url"),
        auth: randomBytes(16).toString("base64url"),
      },
    }

    const details = webpush.generateRequestDetails(
      subscription,
      JSON.stringify({ title: "T", body: "B", url: "/x" })
    )

    expect(details.endpoint).toBe(subscription.endpoint)
    expect(details.method).toBe("POST")
    expect(details.headers.Authorization).toContain(vapid.publicKey)
    expect(details.headers["Content-Encoding"]).toBe("aes128gcm")
    expect(details.body).toBeInstanceOf(Buffer)
  })
})
