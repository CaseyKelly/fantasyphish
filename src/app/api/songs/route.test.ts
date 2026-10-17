import { describe, it, expect, vi, beforeEach } from "vitest"

vi.mock("@/lib/prisma", async () => {
  const { createPrismaMock } = await import("@/test-utils/prisma-mock")
  return { prisma: createPrismaMock() }
})

import { prisma } from "@/lib/prisma"
import { resetPrismaMock, type PrismaMock } from "@/test-utils/prisma-mock"
import { GET } from "./route"

const db = prisma as unknown as PrismaMock

beforeEach(() => {
  resetPrismaMock(db)
  vi.spyOn(console, "error").mockImplementation(() => {})
})

describe("GET /api/songs", () => {
  it("returns songs ordered by recent popularity", async () => {
    db.song.findMany.mockResolvedValue([{ id: "1", name: "Tweezer" }])
    expect(await (await GET()).json()).toEqual({
      songs: [{ id: "1", name: "Tweezer" }],
    })
    expect(db.song.findMany.mock.calls[0][0].orderBy).toEqual([
      { recentTimesPlayed: "desc" },
      { name: "asc" },
    ])
  })

  it("returns 500 on errors", async () => {
    db.song.findMany.mockRejectedValue(new Error("x"))
    expect((await GET()).status).toBe(500)
  })
})
