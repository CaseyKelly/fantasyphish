import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"

vi.mock("@/lib/prisma", async () => {
  const { createPrismaMock } = await import("@/test-utils/prisma-mock")
  return { prisma: createPrismaMock() }
})

import { prisma } from "@/lib/prisma"
import { resetPrismaMock, type PrismaMock } from "@/test-utils/prisma-mock"
import sitemap from "./sitemap"
import robots from "./robots"
import { GET as manifest } from "./manifest.json/route"

const db = prisma as unknown as PrismaMock
const DAY = 24 * 60 * 60 * 1000

beforeEach(() => {
  resetPrismaMock(db)
  vi.stubEnv("NEXT_PUBLIC_APP_URL", "https://fp.test")
})

afterEach(() => {
  vi.unstubAllEnvs()
})

describe("sitemap", () => {
  it("lists static pages, completed tours, and shows weighted by recency", async () => {
    const now = Date.now()
    db.show.findMany.mockResolvedValue([
      { id: "recent", updatedAt: new Date(now - 5 * DAY) },
      { id: "mid", updatedAt: new Date(now - 60 * DAY) },
      { id: "old", updatedAt: new Date(now - 200 * DAY) },
    ])
    db.tour.findMany.mockResolvedValue([{ id: "t1", updatedAt: new Date(now) }])

    const entries = await sitemap()
    const byUrl = Object.fromEntries(entries.map((e) => [e.url, e]))

    expect(byUrl["https://fp.test"].priority).toBe(1)
    expect(byUrl["https://fp.test/leaderboard/t1"].priority).toBe(0.6)
    expect(byUrl["https://fp.test/results_detail/recent"].priority).toBe(0.7)
    expect(byUrl["https://fp.test/results_detail/mid"].priority).toBe(0.5)
    expect(byUrl["https://fp.test/results_detail/old"].priority).toBe(0.3)
  })

  it("defaults the base URL to localhost", async () => {
    vi.stubEnv("NEXT_PUBLIC_APP_URL", "")
    db.show.findMany.mockResolvedValue([])
    db.tour.findMany.mockResolvedValue([])
    expect((await sitemap())[0].url).toBe("http://localhost:3000")
  })
})

describe("robots", () => {
  it("points at the sitemap and hides private routes", () => {
    const result = robots()
    expect(result.sitemap).toBe("https://fp.test/sitemap.xml")
    const rules = Array.isArray(result.rules) ? result.rules[0] : result.rules
    expect(rules.disallow).toContain("/api/")
    vi.stubEnv("NEXT_PUBLIC_APP_URL", "")
    expect(robots().sitemap).toBe("http://localhost:3000/sitemap.xml")
  })
})

describe("manifest.json", () => {
  it("serves a cacheable PWA manifest", async () => {
    const res = await manifest()
    expect(res.headers.get("cache-control")).toContain("max-age=3600")
    const json = await res.json()
    expect(json).toMatchObject({
      short_name: "FantasyPhish",
      display: "standalone",
    })
    expect(json.icons).toHaveLength(4)
  })
})
