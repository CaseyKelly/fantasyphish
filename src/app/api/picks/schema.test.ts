import { describe, it, expect } from "vitest"
import { submitPicksSchema } from "./schema"

describe("submitPicksSchema", () => {
  it("accepts a valid payload", () => {
    const result = submitPicksSchema.safeParse({
      showId: "show-1",
      picks: [{ songId: "song-1", pickType: "OPENER" }],
    })
    expect(result.success).toBe(true)
  })

  it("rejects a missing showId", () => {
    const result = submitPicksSchema.safeParse({
      picks: [{ songId: "song-1", pickType: "OPENER" }],
    })
    expect(result.success).toBe(false)
  })

  it("currently allows an empty picks array (no .min(1) on the schema)", () => {
    const result = submitPicksSchema.safeParse({ showId: "show-1", picks: [] })
    expect(result.success).toBe(true)
  })

  it("rejects an invalid pickType", () => {
    const result = submitPicksSchema.safeParse({
      showId: "show-1",
      picks: [{ songId: "song-1", pickType: "BOGUS" }],
    })
    expect(result.success).toBe(false)
  })
})
