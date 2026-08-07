import { describe, it, expect, vi } from "vitest"

// achievement-awards.ts imports @/lib/prisma at module load, which would
// construct a real PrismaClient. Mock it out since these two helpers never
// touch prisma at runtime. Vitest hoists vi.mock above the imports below.
vi.mock("@/lib/prisma", () => ({ prisma: {} }))

import { sanitizeTourName, getPlacementSuffix } from "./achievement-awards"

describe("sanitizeTourName", () => {
  it("lowercases and replaces non-alphanumeric runs with a single hyphen", () => {
    expect(sanitizeTourName("Summer Tour 2025!")).toBe("summer-tour-2025")
  })

  it("strips leading/trailing hyphens", () => {
    expect(sanitizeTourName("  Fall Tour  ")).toBe("fall-tour")
  })

  it("collapses consecutive separators into one hyphen", () => {
    expect(sanitizeTourName("NYE Run -- 2025")).toBe("nye-run-2025")
  })
})

describe("getPlacementSuffix", () => {
  it.each([
    [1, "champion"],
    [2, "runner-up"],
    [3, "third-place"],
  ] as const)("placement %d -> %s", (placement, suffix) => {
    expect(getPlacementSuffix(placement)).toBe(suffix)
  })
})
