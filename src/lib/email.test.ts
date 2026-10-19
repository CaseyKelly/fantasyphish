import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"

const sendMock = vi.fn()
vi.mock("resend", () => ({
  Resend: vi.fn(function () {
    return { emails: { send: sendMock } }
  }),
}))

// email.ts reads SKIP_EMAIL_SEND/FROM_EMAIL at module load, so re-import per
// test after setting env.
async function loadEmail() {
  vi.resetModules()
  return import("./email")
}

beforeEach(() => {
  sendMock.mockReset()
  vi.stubEnv("RESEND_API_KEY", "re_test")
  vi.stubEnv("NEXT_PUBLIC_APP_URL", "https://app.test")
  vi.stubEnv("SKIP_EMAIL_SEND", "")
  vi.spyOn(console, "error").mockImplementation(() => {})
  vi.spyOn(console, "log").mockImplementation(() => {})
})

afterEach(() => {
  vi.unstubAllEnvs()
  vi.restoreAllMocks()
})

describe("sendVerificationEmail", () => {
  it("sends a verification link", async () => {
    sendMock.mockResolvedValue({ error: null })
    const { sendVerificationEmail } = await loadEmail()
    expect(await sendVerificationEmail("a@b.com", "tok")).toEqual({
      success: true,
    })
    const args = sendMock.mock.calls[0][0]
    expect(args.to).toBe("a@b.com")
    expect(args.html).toContain("https://app.test/verify?token=tok")
    expect(args.headers["X-Entity-Ref-ID"]).toBe("tok")
  })

  it("defaults the app URL to localhost", async () => {
    vi.stubEnv("NEXT_PUBLIC_APP_URL", "")
    sendMock.mockResolvedValue({ error: null })
    const { sendVerificationEmail } = await loadEmail()
    await sendVerificationEmail("a@b.com", "tok")
    expect(sendMock.mock.calls[0][0].html).toContain(
      "http://localhost:3000/verify?token=tok"
    )
  })

  it("skips the API when SKIP_EMAIL_SEND is set", async () => {
    vi.stubEnv("SKIP_EMAIL_SEND", "true")
    const { sendVerificationEmail } = await loadEmail()
    expect(await sendVerificationEmail("a@b.com", "tok")).toEqual({
      success: true,
    })
    expect(sendMock).not.toHaveBeenCalled()
  })

  it("returns Resend's error message", async () => {
    sendMock.mockResolvedValue({ error: { message: "rate limited" } })
    const { sendVerificationEmail } = await loadEmail()
    expect(await sendVerificationEmail("a@b.com", "tok")).toEqual({
      success: false,
      error: "rate limited",
    })
  })

  it("returns a generic error when the client can't be built", async () => {
    vi.stubEnv("RESEND_API_KEY", "")
    const { sendVerificationEmail } = await loadEmail()
    expect(await sendVerificationEmail("a@b.com", "tok")).toEqual({
      success: false,
      error: "Failed to send verification email",
    })
  })
})

describe("sendPasswordResetEmail", () => {
  it("sends a reset link", async () => {
    sendMock.mockResolvedValue({ error: null })
    const { sendPasswordResetEmail } = await loadEmail()
    expect(await sendPasswordResetEmail("a@b.com", "rt")).toEqual({
      success: true,
    })
    expect(sendMock.mock.calls[0][0].html).toContain(
      "https://app.test/reset-password?token=rt"
    )
  })

  it("defaults the app URL to localhost", async () => {
    vi.stubEnv("NEXT_PUBLIC_APP_URL", "")
    sendMock.mockResolvedValue({ error: null })
    const { sendPasswordResetEmail } = await loadEmail()
    await sendPasswordResetEmail("a@b.com", "rt")
    expect(sendMock.mock.calls[0][0].html).toContain("http://localhost:3000")
  })

  it("reports Resend and thrown errors", async () => {
    sendMock.mockResolvedValueOnce({ error: { message: "bad" } })
    const { sendPasswordResetEmail } = await loadEmail()
    expect(await sendPasswordResetEmail("a@b.com", "rt")).toEqual({
      success: false,
      error: "bad",
    })
    sendMock.mockRejectedValueOnce(new Error("network"))
    expect(await sendPasswordResetEmail("a@b.com", "rt")).toEqual({
      success: false,
      error: "Failed to send password reset email",
    })
  })
})

describe("sendShowReminderEmail", () => {
  const show = {
    venue: "MSG",
    city: "New York",
    state: "NY",
    showDate: new Date("2025-07-04T00:00:00Z"),
    lockTime: new Date("2025-07-04T23:00:00Z"),
    timezone: "America/New_York",
  }

  it("formats lock time in the venue timezone", async () => {
    sendMock.mockResolvedValue({ error: null })
    const { sendShowReminderEmail } = await loadEmail()
    expect(await sendShowReminderEmail("a@b.com", show)).toEqual({
      success: true,
    })
    const args = sendMock.mock.calls[0][0]
    expect(args.subject).toBe(
      "Reminder: Submit your picks for tonight's show at MSG"
    )
    expect(args.html).toContain("7:00 PM EDT")
    expect(args.html).toContain(" in New York, NY")
    expect(args.html).not.toContain("shows in a row")
  })

  it("calls out a streak at risk and handles missing location/timezone", async () => {
    vi.stubEnv("NEXT_PUBLIC_APP_URL", "")
    sendMock.mockResolvedValue({ error: null })
    const { sendShowReminderEmail } = await loadEmail()
    await sendShowReminderEmail("a@b.com", {
      ...show,
      city: null,
      state: null,
      timezone: null,
      streakAtRisk: 5,
    })
    const args = sendMock.mock.calls[0][0]
    expect(args.subject).toContain("Keep your 5-show streak alive")
    expect(args.html).toContain("5 shows in a row")
    expect(args.html).not.toContain(" in New York")
    expect(args.html).toContain("http://localhost:3000/picks")
  })

  it("reports Resend and thrown errors", async () => {
    sendMock.mockResolvedValueOnce({ error: { message: "nope" } })
    const { sendShowReminderEmail } = await loadEmail()
    expect(await sendShowReminderEmail("a@b.com", show)).toEqual({
      success: false,
      error: "nope",
    })
    sendMock.mockRejectedValueOnce(new Error("x"))
    expect(await sendShowReminderEmail("a@b.com", show)).toEqual({
      success: false,
      error: "Failed to send show reminder email",
    })
  })
})
