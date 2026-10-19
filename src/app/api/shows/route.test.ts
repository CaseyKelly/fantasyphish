import { describe, it, expect, vi, beforeEach } from "vitest"

vi.mock("@/lib/prisma", async () => {
  const { createPrismaMock } = await import("@/test-utils/prisma-mock")
  return { prisma: createPrismaMock() }
})
vi.mock("@/lib/auth", () => ({ auth: vi.fn() }))
vi.mock("@/lib/phishnet", () => ({ getUpcomingShows: vi.fn() }))

import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { getUpcomingShows } from "@/lib/phishnet"
import { resetPrismaMock, type PrismaMock } from "@/test-utils/prisma-mock"
import { makeRequest, sessionFor } from "@/test-utils/request"
import { GET } from "./route"

const db = prisma as unknown as PrismaMock
const authMock = vi.mocked(auth)
const upcomingMock = vi.mocked(getUpcomingShows)

beforeEach(() => {
  resetPrismaMock(db)
  authMock.mockReset()
  authMock.mockResolvedValue(null as never)
  upcomingMock.mockReset()
  upcomingMock.mockResolvedValue([])
  vi.spyOn(console, "error").mockImplementation(() => {})
})

describe("GET /api/shows?next=true", () => {
  it("returns null when there is no upcoming show", async () => {
    db.show.findFirst.mockResolvedValue(null)
    const json = await (await GET(makeRequest("/api/shows?next=true"))).json()
    expect(json).toEqual({ nextShow: null })
    expect(db.show.findFirst.mock.calls[0][0].include.submissions).toBe(false)
  })

  it("includes the signed-in user's submission", async () => {
    authMock.mockResolvedValue(sessionFor())
    db.show.findFirst.mockResolvedValue({
      id: "s1",
      venue: "MSG",
      city: "NYC",
      state: "NY",
      country: "USA",
      showDate: "2025-07-04T00:00:00.000Z",
      isComplete: false,
      lockTime: null,
      timezone: "America/New_York",
      tour: { id: "t1" },
      submissions: [{ id: "sub-1" }],
    })
    const json = await (await GET(makeRequest("/api/shows?next=true"))).json()
    expect(json.nextShow).toMatchObject({
      id: "s1",
      tour: { id: "t1" },
      userSubmission: { id: "sub-1" },
    })
    expect(
      db.show.findFirst.mock.calls[0][0].include.submissions.where
    ).toEqual({ userId: "user-1" })
  })

  it("returns a null submission for anonymous users", async () => {
    db.show.findFirst.mockResolvedValue({ id: "s1", submissions: undefined })
    const json = await (await GET(makeRequest("/api/shows?next=true"))).json()
    expect(json.nextShow.userSubmission).toBeNull()
  })
})

describe("GET /api/shows", () => {
  it("upserts upcoming phish.net shows at midnight UTC and lists shows", async () => {
    upcomingMock.mockResolvedValue([
      {
        showdate: "2025-07-04",
        venue: "MSG",
        city: "NYC",
        state: "NY",
        country: "USA",
      },
    ] as never)
    db.show.findMany.mockResolvedValue([
      {
        id: "s1",
        venue: "MSG",
        city: "NYC",
        state: "NY",
        showDate: "2025-07-04T00:00:00.000Z",
        isComplete: false,
        lockTime: null,
        tour: null,
        _count: { submissions: 3 },
      },
    ])

    const json = await (await GET(makeRequest("/api/shows"))).json()

    const upsert = db.show.upsert.mock.calls[0][0]
    expect(upsert.where.showDate.toISOString()).toBe("2025-07-04T00:00:00.000Z")
    expect(upsert.create.venue).toBe("MSG")
    expect(json.shows).toEqual([
      {
        id: "s1",
        venue: "MSG",
        city: "NYC",
        state: "NY",
        showDate: "2025-07-04T00:00:00.000Z",
        isComplete: false,
        lockTime: null,
        submissionCount: 3,
        tour: null,
      },
    ])
  })

  it("returns 500 on errors", async () => {
    db.show.findMany.mockRejectedValue(new Error("x"))
    expect((await GET(makeRequest("/api/shows"))).status).toBe(500)
  })
})
