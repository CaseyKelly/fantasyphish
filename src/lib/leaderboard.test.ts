import { describe, it, expect, vi } from "vitest"

// leaderboard.ts imports @/lib/prisma (and transitively @/lib/db-retry) at
// module load; mock prisma out since these two where-clause builders never
// touch it at runtime.
vi.mock("@/lib/prisma", () => ({ prisma: {} }))

import { tourSubmissionWhere, showSubmissionWhere } from "./leaderboard"

describe("tourSubmissionWhere", () => {
  it("builds the no-tour OR branch (all scored, or locked-in-unscored) plus the test-venue exclusion", () => {
    const where = tourSubmissionWhere(undefined)
    expect(where.OR).toHaveLength(2)
    expect(where.OR).toContainEqual({ isScored: true })
    expect(where.OR?.[1]).toMatchObject({ isScored: false })
    expect(where.NOT).toEqual({ show: { venue: { contains: "Test Venue" } } })
  })

  it("scopes both OR branches to the given tour when tourId is provided", () => {
    const where = tourSubmissionWhere("tour-123")
    expect(where.OR).toContainEqual({
      isScored: true,
      show: { tourId: "tour-123" },
    })
    expect(where.OR?.[1]).toMatchObject({
      isScored: false,
      show: expect.objectContaining({ tourId: "tour-123" }),
    })
    expect(where.NOT).toEqual({ show: { venue: { contains: "Test Venue" } } })
  })
})

describe("showSubmissionWhere", () => {
  it("scopes to the given show and includes the same OR/NOT structure", () => {
    const where = showSubmissionWhere("show-456")
    expect(where.showId).toBe("show-456")
    expect(where.OR).toHaveLength(2)
    expect(where.OR).toContainEqual({ isScored: true })
    expect(where.OR?.[1]).toMatchObject({ isScored: false })
    expect(where.NOT).toEqual({ show: { venue: { contains: "Test Venue" } } })
  })
})
