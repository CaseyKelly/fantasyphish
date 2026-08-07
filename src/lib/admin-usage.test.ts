import { describe, it, expect, vi } from "vitest"

// admin-usage.ts imports @/lib/prisma at module load; mock it out since
// pctOf never touches prisma at runtime.
vi.mock("@/lib/prisma", () => ({ prisma: {} }))

import { pctOf } from "./admin-usage"

describe("pctOf", () => {
  it("returns 0 when total is 0 (no divide-by-zero)", () => {
    expect(pctOf(5, 0)).toBe(0)
  })

  it("rounds to the nearest whole percent", () => {
    expect(pctOf(1, 3)).toBe(33)
  })

  it("rounds .5 up", () => {
    expect(pctOf(1, 8)).toBe(13) // 12.5 -> 13
  })
})
