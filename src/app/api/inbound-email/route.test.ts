import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"

const resend = vi.hoisted(() => ({
  verify: vi.fn(),
  get: vi.fn(),
  listAttachments: vi.fn(),
  send: vi.fn(),
}))

vi.mock("resend", () => ({
  Resend: vi.fn(function () {
    return {
      webhooks: { verify: resend.verify },
      emails: {
        send: resend.send,
        receiving: {
          get: resend.get,
          attachments: { list: resend.listAttachments },
        },
      },
    }
  }),
}))

import { makeRequest } from "@/test-utils/request"
import { POST } from "./route"

const received = {
  type: "email.received",
  data: {
    email_id: "em_1",
    from: "fan@example.com",
    to: ["hello@fantasyphish.com"],
    subject: "Hi",
    cc: [],
    attachments: [],
  },
}

function post(body: unknown, headers: Record<string, string> = {}) {
  return POST(
    makeRequest("/api/inbound-email", {
      method: "POST",
      body: JSON.stringify(body),
      headers,
    })
  )
}

const svix = {
  "svix-id": "id",
  "svix-timestamp": "ts",
  "svix-signature": "sig",
}

beforeEach(() => {
  Object.values(resend).forEach((fn) => fn.mockReset())
  resend.get.mockResolvedValue({ data: { html: "<p>hello</p>" }, error: null })
  resend.send.mockResolvedValue({ data: { id: "fwd_1" }, error: null })
  vi.stubEnv("RESEND_WEBHOOK_SECRET", "")
  vi.spyOn(console, "log").mockImplementation(() => {})
  vi.spyOn(console, "error").mockImplementation(() => {})
})

afterEach(() => {
  vi.unstubAllEnvs()
  vi.restoreAllMocks()
})

describe("POST /api/inbound-email", () => {
  it("acknowledges non-received events without forwarding", async () => {
    const json = await (await post({ type: "email.sent", data: {} })).json()
    expect(json).toEqual({ received: true })
    expect(resend.send).not.toHaveBeenCalled()
  })

  it("forwards received emails with their HTML body", async () => {
    const json = await (await post(received)).json()
    expect(json).toEqual({ received: true, forwarded: "fwd_1" })
    const args = resend.send.mock.calls[0][0]
    expect(args.subject).toBe("FWD: Hi")
    expect(args.html).toContain("<p>hello</p>")
    expect(args.html).toContain("fan@example.com")
    expect(args.html).not.toContain("CC:")
  })

  it("falls back to text, then a placeholder, and includes CC and attachments", async () => {
    resend.get.mockResolvedValueOnce({
      data: { text: "line1\nline2" },
      error: null,
    })
    resend.listAttachments.mockResolvedValue({
      data: {
        data: [
          { download_url: "https://dl/1", filename: "a.pdf", size: 2048 },
          { download_url: "https://dl/2" },
        ],
      },
    })
    await post({
      ...received,
      data: { ...received.data, cc: ["cc@x.com"], attachments: [{}] },
    })
    const html = resend.send.mock.calls[0][0].html
    expect(html).toContain("line1<br>line2")
    expect(html).toContain("CC:</strong> cc@x.com")
    expect(html).toContain("📎 a.pdf (2KB)")
    expect(html).toContain("📎 attachment (0KB)")

    resend.get.mockResolvedValueOnce({ data: {}, error: null })
    resend.listAttachments.mockResolvedValueOnce({ data: null })
    await post({ ...received, data: { ...received.data, attachments: [{}] } })
    expect(resend.send.mock.calls[1][0].html).toContain("<p>No content</p>")
  })

  it("500s when fetching or forwarding fails", async () => {
    resend.get.mockResolvedValueOnce({ data: null, error: { message: "x" } })
    expect((await post(received)).status).toBe(500)
    resend.send.mockResolvedValueOnce({ data: null, error: { message: "x" } })
    expect((await post(received)).status).toBe(500)
  })

  it("500s on malformed JSON", async () => {
    const res = await POST(
      makeRequest("/api/inbound-email", { method: "POST", body: "{bad" })
    )
    expect(res.status).toBe(500)
  })

  describe("with a webhook secret", () => {
    beforeEach(() => {
      vi.stubEnv("RESEND_WEBHOOK_SECRET", "whsec")
    })

    it("requires svix headers", async () => {
      expect((await post(received)).status).toBe(401)
    })

    it("rejects bad signatures", async () => {
      resend.verify.mockImplementation(() => {
        throw new Error("bad sig")
      })
      const res = await post(received, svix)
      expect((await res.json()).error).toBe("Invalid webhook signature")
    })

    it("accepts valid signatures", async () => {
      expect((await post(received, svix)).status).toBe(200)
      expect(resend.verify.mock.calls[0][0]).toMatchObject({
        headers: { id: "id", timestamp: "ts", signature: "sig" },
        webhookSecret: "whsec",
      })
    })
  })
})
