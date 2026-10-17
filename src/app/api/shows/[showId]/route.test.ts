import { describe, it, expect, vi, beforeEach } from "vitest"

vi.mock("@/lib/prisma", async () => {
  const { createPrismaMock } = await import("@/test-utils/prisma-mock")
  return { prisma: createPrismaMock() }
})
vi.mock("@/lib/phishnet", () => ({ hasShowStarted: vi.fn() }))

import { prisma } from "@/lib/prisma"
import { hasShowStarted } from "@/lib/phishnet"
import { resetPrismaMock, type PrismaMock } from "@/test-utils/prisma-mock"
import { makeRequest, routeParams } from "@/test-utils/request"
import { GET } from "./route"

const db = prisma as unknown as PrismaMock

function get() {
  return GET(makeRequest("/api/shows/s1"), routeParams({ showId: "s1" }))
}

beforeEach(() => {
  resetPrismaMock(db)
  vi.mocked(hasShowStarted).mockReset()
  vi.spyOn(console, "error").mockImplementation(() => {})
})

describe("GET /api/shows/[showId]", () => {
  it("404s for unknown shows", async () => {
    db.show.findUnique.mockResolvedValue(null)
    expect((await get()).status).toBe(404)
  })

  it("adds isLocked from the timezone-aware check", async () => {
    db.show.findUnique.mockResolvedValue({
      id: "s1",
      showDate: new Date("2025-07-04T00:00:00Z"),
      timezone: "America/New_York",
      state: "NY",
    })
    vi.mocked(hasShowStarted).mockResolvedValue(true)
    const json = await (await get()).json()
    expect(json.show).toMatchObject({ id: "s1", isLocked: true })
    expect(hasShowStarted).toHaveBeenCalledWith(
      "2025-07-04",
      "America/New_York",
      "NY"
    )
  })

  it("returns 500 on errors", async () => {
    db.show.findUnique.mockRejectedValue(new Error("x"))
    expect((await get()).status).toBe(500)
  })
})
