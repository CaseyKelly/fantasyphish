import { describe, it, expect } from "vitest"
import { updatePreferencesSchema } from "./schema"

describe("updatePreferencesSchema", () => {
  it("rejects an empty object (refine requires at least one key)", () => {
    expect(updatePreferencesSchema.safeParse({}).success).toBe(false)
  })

  it("accepts a valid single-key payload", () => {
    const result = updatePreferencesSchema.safeParse({
      emailPickReminders: true,
    })
    expect(result.success).toBe(true)
  })

  it("strips unknown keys rather than rejecting them, as long as a known key remains", () => {
    const result = updatePreferencesSchema.safeParse({
      emailPickReminders: true,
      someUnknownField: "x",
    })
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data).toEqual({ emailPickReminders: true })
    }
  })

  it("rejects a payload with only unknown keys (nothing recognized survives stripping)", () => {
    const result = updatePreferencesSchema.safeParse({ someUnknownField: "x" })
    expect(result.success).toBe(false)
  })
})
