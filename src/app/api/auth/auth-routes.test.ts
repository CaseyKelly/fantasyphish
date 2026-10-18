import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"

vi.mock("@/lib/prisma", async () => {
  const { createPrismaMock } = await import("@/test-utils/prisma-mock")
  return { prisma: createPrismaMock() }
})
vi.mock("@/lib/email", () => ({
  sendVerificationEmail: vi.fn(),
  sendPasswordResetEmail: vi.fn(),
}))
vi.mock("bcryptjs", () => ({ hash: vi.fn(async () => "hashed") }))
vi.mock("@/lib/auth", () => ({ handlers: { GET: vi.fn(), POST: vi.fn() } }))

import { prisma } from "@/lib/prisma"
import { handlers } from "@/lib/auth"
import { sendVerificationEmail, sendPasswordResetEmail } from "@/lib/email"
import { resetPrismaMock, type PrismaMock } from "@/test-utils/prisma-mock"
import { makeRequest } from "@/test-utils/request"
import * as nextauthRoute from "./[...nextauth]/route"
import { POST as checkUser } from "./check-user/route"
import { POST as forgotPassword } from "./forgot-password/route"
import { POST as register } from "./register/route"
import { POST as resetPassword } from "./reset-password/route"
import { GET as verify } from "./verify/route"

const db = prisma as unknown as PrismaMock
const verifyEmailMock = vi.mocked(sendVerificationEmail)
const resetEmailMock = vi.mocked(sendPasswordResetEmail)

function post(body: unknown, headers?: Record<string, string>) {
  return makeRequest("/x", { method: "POST", body, headers })
}

beforeEach(() => {
  resetPrismaMock(db)
  verifyEmailMock.mockReset()
  verifyEmailMock.mockResolvedValue({ success: true })
  resetEmailMock.mockReset()
  resetEmailMock.mockResolvedValue({ success: true })
  vi.spyOn(console, "error").mockImplementation(() => {})
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe("/api/auth/[...nextauth]", () => {
  it("re-exports the NextAuth handlers", () => {
    expect(nextauthRoute.GET).toBe(handlers.GET)
    expect(nextauthRoute.POST).toBe(handlers.POST)
  })
})

describe("POST /api/auth/check-user", () => {
  it("requires an email", async () => {
    expect((await checkUser(post({}))).status).toBe(400)
  })

  it("reports existence and verification", async () => {
    db.user.findUnique.mockResolvedValueOnce(null)
    expect(await (await checkUser(post({ email: "A@B.com" }))).json()).toEqual({
      exists: false,
      verified: false,
    })
    expect(db.user.findUnique.mock.calls[0][0].where).toEqual({
      email: "a@b.com",
    })

    db.user.findUnique.mockResolvedValueOnce({
      id: "u",
      emailVerified: new Date(),
    })
    expect(await (await checkUser(post({ email: "a@b.com" }))).json()).toEqual({
      exists: true,
      verified: true,
    })
  })

  it("returns 500 on errors", async () => {
    db.user.findUnique.mockRejectedValue(new Error("x"))
    expect((await checkUser(post({ email: "a@b.com" }))).status).toBe(500)
  })
})

describe("POST /api/auth/forgot-password", () => {
  it("validates the email", async () => {
    const res = await forgotPassword(post({ email: "nope" }))
    expect(res.status).toBe(400)
    expect((await res.json()).error).toBe("Invalid email address")
  })

  it("returns success for unknown emails without sending", async () => {
    db.user.findUnique.mockResolvedValue(null)
    const json = await (await forgotPassword(post({ email: "a@b.com" }))).json()
    expect(json.success).toBe(true)
    expect(resetEmailMock).not.toHaveBeenCalled()
  })

  it("stores a 1-hour token and emails it", async () => {
    db.user.findUnique.mockResolvedValue({ id: "u1", email: "a@b.com" })
    const before = Date.now()
    await forgotPassword(post({ email: "a@b.com" }))
    const data = db.user.update.mock.calls[0][0].data
    expect(data.passwordResetToken).toMatch(/^[0-9a-f]{64}$/)
    expect(data.passwordResetExpiry.getTime() - before).toBeGreaterThanOrEqual(
      60 * 60 * 1000 - 10
    )
    expect(resetEmailMock).toHaveBeenCalledWith(
      "a@b.com",
      data.passwordResetToken
    )
  })

  it("500s when the email fails or something throws", async () => {
    db.user.findUnique.mockResolvedValue({ id: "u1", email: "a@b.com" })
    resetEmailMock.mockResolvedValue({ success: false, error: "x" })
    expect((await forgotPassword(post({ email: "a@b.com" }))).status).toBe(500)
    db.user.findUnique.mockRejectedValue(new Error("x"))
    expect((await forgotPassword(post({ email: "a@b.com" }))).status).toBe(500)
  })
})

describe("POST /api/auth/register", () => {
  const body = { email: "New@B.com", username: "newbie", password: "password1" }

  function picks() {
    return [
      { songId: "o", pickType: "OPENER" },
      { songId: "e", pickType: "ENCORE" },
      ...Array.from({ length: 11 }, (_, i) => ({
        songId: `r${i}`,
        pickType: "REGULAR",
      })),
    ]
  }

  it("validates input", async () => {
    const res = await register(post({ ...body, username: "x" }))
    expect(res.status).toBe(400)
  })

  it("rejects a taken email or case-insensitive username", async () => {
    db.user.findUnique.mockResolvedValueOnce({ id: "u" })
    expect((await (await register(post(body))).json()).error).toContain("email")

    db.user.findUnique.mockResolvedValueOnce(null)
    db.user.findMany.mockResolvedValueOnce([{ username: "NEWBIE" }])
    expect((await (await register(post(body))).json()).error).toContain(
      "username"
    )
  })

  it("creates the user and sends a verification email", async () => {
    db.user.findUnique.mockResolvedValue(null)
    db.user.findMany.mockResolvedValue([])
    db.user.create.mockResolvedValue({ id: "u1", email: "new@b.com" })

    const json = await (await register(post(body))).json()

    expect(json).toEqual({
      success: true,
      message:
        "Registration successful! Please check your email to verify your account.",
    })
    expect(db.user.create.mock.calls[0][0].data).toMatchObject({
      email: "new@b.com",
      username: "newbie",
      passwordHash: "hashed",
    })
    expect(db.submission.create).not.toHaveBeenCalled()
    expect(verifyEmailMock).toHaveBeenCalledWith(
      "new@b.com",
      expect.any(String)
    )
  })

  it("saves guest picks along with the account", async () => {
    db.user.findUnique.mockResolvedValue(null)
    db.user.findMany.mockResolvedValue([])
    db.user.create.mockResolvedValue({ id: "u1", email: "new@b.com" })
    db.submission.create.mockResolvedValue({ id: "sub-1" })
    // picks() is a one-set submission: one opener, one encore, 11 regular
    db.show.findUnique.mockResolvedValue({ setCount: 1 })
    verifyEmailMock.mockResolvedValue({ success: false, error: "quota" })

    const json = await (
      await register(post({ ...body, showId: "s1", picks: picks() }))
    ).json()

    expect(json.message).toContain("Your picks have been saved")
    expect(
      db.submission.create.mock.calls[0][0].data.picks.create
    ).toHaveLength(13)
  })

  it("rejects guest picks that don't match the show's set count", async () => {
    db.user.findUnique.mockResolvedValue(null)
    db.user.findMany.mockResolvedValue([])
    db.show.findUnique.mockResolvedValue({ setCount: 2 })

    const res = await register(post({ ...body, showId: "s1", picks: picks() }))

    expect(res.status).toBe(400)
    expect((await res.json()).error).toContain("exactly 2 openers")
    expect(db.user.create).not.toHaveBeenCalled()
  })

  it("404s guest picks for an unknown show", async () => {
    db.user.findUnique.mockResolvedValue(null)
    db.user.findMany.mockResolvedValue([])
    db.show.findUnique.mockResolvedValue(null)

    const res = await register(post({ ...body, showId: "s1", picks: picks() }))

    expect(res.status).toBe(404)
    expect(db.user.create).not.toHaveBeenCalled()
  })

  it("returns 500 with details on unexpected errors", async () => {
    db.user.findUnique.mockRejectedValueOnce(new Error("db"))
    const res = await register(post(body))
    expect(res.status).toBe(500)
    expect((await res.json()).details).toBe("db")

    db.user.findUnique.mockRejectedValueOnce("raw")
    expect((await (await register(post(body))).json()).details).toBe("raw")
  })
})

describe("POST /api/auth/resend-verification", () => {
  // The route keeps its rate-limit map at module scope, so load a fresh copy
  // per test.
  async function loadResend() {
    vi.resetModules()
    return (await import("./resend-verification/route")).POST
  }

  it("validates the email", async () => {
    const resend = await loadResend()
    expect((await resend(post({ email: "bad" }))).status).toBe(400)
  })

  it("returns a generic success for unknown or verified accounts", async () => {
    const resend = await loadResend()
    db.user.findUnique.mockResolvedValueOnce(null)
    const json = await (await resend(post({ email: "a@b.com" }))).json()
    expect(json.message).toContain("If an account")
    db.user.findUnique.mockResolvedValueOnce({ emailVerified: new Date() })
    expect((await resend(post({ email: "a@b.com" }))).status).toBe(200)
    expect(verifyEmailMock).not.toHaveBeenCalled()
  })

  it("issues a new token and sends the email", async () => {
    const resend = await loadResend()
    db.user.findUnique.mockResolvedValue({
      id: "u1",
      email: "a@b.com",
      emailVerified: null,
    })
    const json = await (await resend(post({ email: "a@b.com" }))).json()
    expect(json.message).toBe("Verification email sent successfully")
    expect(db.user.update.mock.calls[0][0].data.verificationToken).toMatch(
      /^[0-9a-f]{64}$/
    )
  })

  it("hides send failures behind the generic message", async () => {
    const resend = await loadResend()
    db.user.findUnique.mockResolvedValue({
      id: "u1",
      email: "a@b.com",
      emailVerified: null,
    })
    verifyEmailMock.mockResolvedValue({ success: false, error: "x" })
    const json = await (await resend(post({ email: "a@b.com" }))).json()
    expect(json.message).toContain("If an account")
  })

  it("rate limits to 3 requests per IP+email per hour", async () => {
    const resend = await loadResend()
    db.user.findUnique.mockResolvedValue(null)
    const headers = { "x-forwarded-for": "1.2.3.4, 10.0.0.1" }
    for (let i = 0; i < 3; i++) {
      expect((await resend(post({ email: "a@b.com" }, headers))).status).toBe(
        200
      )
    }
    expect((await resend(post({ email: "A@b.com" }, headers))).status).toBe(429)
    // A different IP (via x-real-ip) has its own budget
    expect(
      (await resend(post({ email: "a@b.com" }, { "x-real-ip": "5.6.7.8" })))
        .status
    ).toBe(200)
  })

  it("resets the window after an hour", async () => {
    vi.useFakeTimers()
    try {
      const resend = await loadResend()
      db.user.findUnique.mockResolvedValue(null)
      for (let i = 0; i < 3; i++) await resend(post({ email: "a@b.com" }))
      expect((await resend(post({ email: "a@b.com" }))).status).toBe(429)
      vi.advanceTimersByTime(60 * 60 * 1000 + 1)
      expect((await resend(post({ email: "a@b.com" }))).status).toBe(200)
    } finally {
      vi.useRealTimers()
    }
  })

  it("returns 500 on unexpected errors", async () => {
    const resend = await loadResend()
    db.user.findUnique.mockRejectedValue(new Error("x"))
    expect((await resend(post({ email: "a@b.com" }))).status).toBe(500)
  })
})

describe("POST /api/auth/reset-password", () => {
  it("validates input", async () => {
    const res = await resetPassword(post({ token: "t", password: "short" }))
    expect((await res.json()).error).toBe(
      "Password must be at least 8 characters"
    )
  })

  it("rejects unknown and expired tokens", async () => {
    db.user.findUnique.mockResolvedValueOnce(null)
    expect(
      (
        await (
          await resetPassword(post({ token: "t", password: "longenough" }))
        ).json()
      ).error
    ).toBe("Invalid or expired reset token")

    db.user.findUnique.mockResolvedValueOnce({
      id: "u",
      passwordResetExpiry: new Date(Date.now() - 1000),
    })
    expect(
      (
        await (
          await resetPassword(post({ token: "t", password: "longenough" }))
        ).json()
      ).error
    ).toContain("expired")

    db.user.findUnique.mockResolvedValueOnce({
      id: "u",
      passwordResetExpiry: null,
    })
    expect(
      (await resetPassword(post({ token: "t", password: "longenough" }))).status
    ).toBe(400)
  })

  it("updates the password and clears the token", async () => {
    db.user.findUnique.mockResolvedValue({
      id: "u1",
      passwordResetExpiry: new Date(Date.now() + 60_000),
    })
    const json = await (
      await resetPassword(post({ token: "t", password: "longenough" }))
    ).json()
    expect(json.success).toBe(true)
    expect(db.user.update.mock.calls[0][0].data).toEqual({
      passwordHash: "hashed",
      passwordResetToken: null,
      passwordResetExpiry: null,
    })
  })

  it("returns 500 on unexpected errors", async () => {
    db.user.findUnique.mockRejectedValue(new Error("x"))
    expect(
      (await resetPassword(post({ token: "t", password: "longenough" }))).status
    ).toBe(500)
  })
})

describe("GET /api/auth/verify", () => {
  const get = (q = "?token=t") => verify(makeRequest(`/api/auth/verify${q}`))

  it("requires a token", async () => {
    expect((await get("")).status).toBe(400)
  })

  it("rejects unknown and expired tokens", async () => {
    db.user.findUnique.mockResolvedValueOnce(null)
    expect((await (await get()).json()).error).toBe(
      "Invalid verification token"
    )
    db.user.findUnique.mockResolvedValueOnce({
      verificationExpiry: new Date(Date.now() - 1000),
    })
    expect((await (await get()).json()).error).toContain("expired")
  })

  it("verifies the user", async () => {
    db.user.findUnique.mockResolvedValue({
      id: "u1",
      email: "a@b.com",
      verificationExpiry: null,
    })
    const json = await (await get()).json()
    expect(json).toMatchObject({ success: true, email: "a@b.com" })
    expect(db.user.update.mock.calls[0][0].data).toMatchObject({
      verificationToken: null,
      verificationExpiry: null,
    })
  })

  it("returns 500 with details on errors", async () => {
    db.user.findUnique.mockRejectedValueOnce(new Error("db"))
    expect((await (await get()).json()).details).toBe("db")
    db.user.findUnique.mockRejectedValueOnce("raw")
    expect((await (await get()).json()).details).toBe("raw")
  })
})
