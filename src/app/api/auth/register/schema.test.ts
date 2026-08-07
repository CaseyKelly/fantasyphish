import { describe, it, expect } from "vitest"
import { registerSchema } from "./schema"

const validPayload = {
  email: "user@example.com",
  username: "phish_phan_1",
  password: "password123",
}

describe("registerSchema", () => {
  it("accepts a valid payload", () => {
    expect(registerSchema.safeParse(validPayload).success).toBe(true)
  })

  it("accepts a valid payload with showId/picks omitted (both optional)", () => {
    const { email, username, password } = validPayload
    expect(
      registerSchema.safeParse({ email, username, password }).success
    ).toBe(true)
  })

  it("rejects an invalid email format", () => {
    const result = registerSchema.safeParse({
      ...validPayload,
      email: "not-an-email",
    })
    expect(result.success).toBe(false)
  })

  it("rejects a username shorter than 3 characters", () => {
    const result = registerSchema.safeParse({ ...validPayload, username: "ab" })
    expect(result.success).toBe(false)
  })

  it("rejects a username longer than 20 characters", () => {
    const result = registerSchema.safeParse({
      ...validPayload,
      username: "a".repeat(21),
    })
    expect(result.success).toBe(false)
  })

  it("rejects a username with disallowed characters", () => {
    const result = registerSchema.safeParse({
      ...validPayload,
      username: "not-valid",
    })
    expect(result.success).toBe(false)
  })

  it("accepts a password exactly at the 8-character boundary", () => {
    const result = registerSchema.safeParse({
      ...validPayload,
      password: "12345678",
    })
    expect(result.success).toBe(true)
  })

  it("rejects a password one character below the boundary", () => {
    const result = registerSchema.safeParse({
      ...validPayload,
      password: "1234567",
    })
    expect(result.success).toBe(false)
  })

  it("rejects an invalid pickType in the optional picks array", () => {
    const result = registerSchema.safeParse({
      ...validPayload,
      showId: "show-1",
      picks: [{ songId: "song-1", pickType: "BOGUS" }],
    })
    expect(result.success).toBe(false)
  })

  it("accepts a valid picks array", () => {
    const result = registerSchema.safeParse({
      ...validPayload,
      showId: "show-1",
      picks: [{ songId: "song-1", pickType: "OPENER" }],
    })
    expect(result.success).toBe(true)
  })
})
