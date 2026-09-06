import { describe, it, expect } from "vitest"
import { updateUsernameSchema } from "./schema"

describe("updateUsernameSchema", () => {
  it("accepts a valid username", () => {
    expect(
      updateUsernameSchema.safeParse({ username: "phish_phan_1" }).success
    ).toBe(true)
  })

  it("rejects a username shorter than 3 characters", () => {
    expect(updateUsernameSchema.safeParse({ username: "ab" }).success).toBe(
      false
    )
  })

  it("rejects a username longer than 20 characters", () => {
    expect(
      updateUsernameSchema.safeParse({ username: "a".repeat(21) }).success
    ).toBe(false)
  })

  it("rejects a username with disallowed characters", () => {
    expect(
      updateUsernameSchema.safeParse({ username: "not-valid" }).success
    ).toBe(false)
  })

  it("rejects a missing username", () => {
    expect(updateUsernameSchema.safeParse({}).success).toBe(false)
  })
})
