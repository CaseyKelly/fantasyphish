import { describe, it, expect } from "vitest"
import { submitScoreSchema } from "./schema"

describe("submitScoreSchema", () => {
  it("accepts the lower boundary (0)", () => {
    expect(submitScoreSchema.safeParse({ score: 0 }).success).toBe(true)
  })

  it("accepts the upper boundary (100000)", () => {
    expect(submitScoreSchema.safeParse({ score: 100_000 }).success).toBe(true)
  })

  it("rejects below the lower boundary (-1)", () => {
    expect(submitScoreSchema.safeParse({ score: -1 }).success).toBe(false)
  })

  it("rejects above the upper boundary (100001)", () => {
    expect(submitScoreSchema.safeParse({ score: 100_001 }).success).toBe(false)
  })

  it("rejects a non-integer score", () => {
    expect(submitScoreSchema.safeParse({ score: 50.5 }).success).toBe(false)
  })
})
