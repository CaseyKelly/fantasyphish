import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { verifyCronRequest } from "./cron-auth"

function makeRequest(headers: Record<string, string>): Request {
  return new Request("https://example.com/api/score", { headers })
}

describe("verifyCronRequest", () => {
  const originalSecret = process.env.CRON_SECRET

  beforeEach(() => {
    vi.spyOn(console, "error").mockImplementation(() => {})
  })

  afterEach(() => {
    vi.restoreAllMocks()
    if (originalSecret === undefined) {
      delete process.env.CRON_SECRET
    } else {
      process.env.CRON_SECRET = originalSecret
    }
  })

  it("authorizes a request with the correct bearer secret", () => {
    process.env.CRON_SECRET = "s3cret"
    const result = verifyCronRequest(
      makeRequest({ authorization: "Bearer s3cret" }),
      "[Test]"
    )
    expect(result).toBeNull()
  })

  it("rejects a wrong bearer secret with 401", () => {
    process.env.CRON_SECRET = "s3cret"
    const result = verifyCronRequest(
      makeRequest({ authorization: "Bearer wrong!" }),
      "[Test]"
    )
    expect(result?.status).toBe(401)
  })

  it("rejects a missing authorization header with 401", () => {
    process.env.CRON_SECRET = "s3cret"
    const result = verifyCronRequest(makeRequest({}), "[Test]")
    expect(result?.status).toBe(401)
  })

  it("does not trust a Vercel-Cron user-agent without the secret", () => {
    process.env.CRON_SECRET = "s3cret"
    const result = verifyCronRequest(
      makeRequest({ "user-agent": "Vercel-Cron" }),
      "[Test]"
    )
    expect(result?.status).toBe(401)
  })

  it("fails closed with 500 when CRON_SECRET is unset", () => {
    delete process.env.CRON_SECRET
    const result = verifyCronRequest(
      makeRequest({
        authorization: "Bearer anything",
        "user-agent": "Vercel-Cron",
      }),
      "[Test]"
    )
    expect(result?.status).toBe(500)
  })
})
