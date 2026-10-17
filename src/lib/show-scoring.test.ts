import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"

vi.mock("@/lib/prisma", async () => {
  const { createPrismaMock } = await import("@/test-utils/prisma-mock")
  return { prisma: createPrismaMock() }
})
vi.mock("@/lib/achievement-awards", () => ({
  processPickAchievements: vi.fn(),
}))

import { prisma } from "@/lib/prisma"
import { processPickAchievements } from "@/lib/achievement-awards"
import { resetPrismaMock, type PrismaMock } from "@/test-utils/prisma-mock"
import {
  scoreShow,
  GRACE_PERIOD_MS,
  type ShowWithSubmissions,
} from "./show-scoring"
import type { PhishNetSetlist, PhishNetSetlistSong } from "./phishnet"

const db = prisma as unknown as PrismaMock
const processMock = vi.mocked(processPickAchievements)

const NOW = new Date("2025-07-05T03:00:00Z")

function song(
  name: string,
  set: string,
  position: number
): PhishNetSetlistSong {
  return {
    songid: position,
    song: name,
    slug: name.toLowerCase(),
    position,
    set,
    isjam: 0,
    isreprise: 0,
    transition: "",
    footnote: "",
    showid: 1,
    showdate: "2025-07-04",
    venue: "MSG",
    city: "New York",
    state: "NY",
    country: "USA",
    setlistnotes: "",
    tourname: "Summer",
    tourid: 1,
  }
}

function setlist(songs: PhishNetSetlistSong[]): PhishNetSetlist {
  return {
    showid: 1,
    showdate: "2025-07-04",
    venue: "MSG",
    city: "New York",
    state: "NY",
    country: "USA",
    setlistnotes: "",
    tour_name: "Summer",
    tourid: 1,
    songs,
  }
}

const set1Only = setlist([song("Tweezer", "1", 1), song("Fee", "1", 2)])
const withEncore = setlist([
  song("Tweezer", "1", 1),
  song("Fee", "1", 2),
  song("Harpua", "e", 1),
])
const withTwoEncores = setlist([
  ...withEncore.songs,
  song("Tweezer Reprise", "e", 2),
])

function makeShow(
  overrides: Partial<ShowWithSubmissions> = {}
): ShowWithSubmissions {
  return {
    id: "show-1",
    showDate: new Date("2025-07-04"),
    venue: "MSG",
    encoreStartedAt: null,
    lastEncoreCount: null,
    submissions: [
      {
        id: "sub-1",
        userId: "user-1",
        isScored: false,
        lastSongCount: 0,
        picks: [
          {
            id: "pick-1",
            pickType: "OPENER",
            wasPlayed: null,
            song: { name: "Tweezer" },
          },
          {
            id: "pick-2",
            pickType: "ENCORE",
            wasPlayed: null,
            song: { name: "Harpua" },
          },
        ],
      },
    ],
    ...overrides,
  } as unknown as ShowWithSubmissions
}

beforeEach(() => {
  resetPrismaMock(db)
  processMock.mockReset()
  processMock.mockResolvedValue({ awarded: 0, errors: 0 })
  vi.useFakeTimers()
  vi.setSystemTime(NOW)
  vi.spyOn(console, "log").mockImplementation(() => {})
  vi.spyOn(console, "error").mockImplementation(() => {})
})

afterEach(() => {
  vi.useRealTimers()
  vi.restoreAllMocks()
})

describe("scoreShow", () => {
  it("scores new songs without completing the show before any encore", async () => {
    const result = await scoreShow(makeShow(), set1Only)

    expect(result).toMatchObject({
      status: "in_progress",
      songCount: 2,
      submissionsProcessed: 1,
      submissionsUpdated: 1,
    })
    const showUpdate = db.show.update.mock.calls[0][0]
    expect(showUpdate.data.isComplete).toBe(false)
    expect(showUpdate.data).not.toHaveProperty("encoreStartedAt")
    expect(db.pick.update).toHaveBeenCalledTimes(2)
    expect(db.submission.update.mock.calls[0][0].data).toMatchObject({
      isScored: false,
      lastSongCount: 2,
    })
    expect(processMock).toHaveBeenCalledTimes(1)
  })

  it("starts the grace period timer when the encore first appears", async () => {
    await scoreShow(makeShow(), withEncore)
    const data = db.show.update.mock.calls[0][0].data
    expect(data.encoreStartedAt).toEqual(NOW)
    expect(data.lastEncoreCount).toBe(1)
    expect(data.isComplete).toBe(false)
  })

  it("resets the timer when more encore songs are added", async () => {
    const show = makeShow({
      encoreStartedAt: new Date(NOW.getTime() - 10 * 60 * 1000),
      lastEncoreCount: 1,
    })
    await scoreShow(show, withTwoEncores)
    const data = db.show.update.mock.calls[0][0].data
    expect(data.encoreStartedAt).toEqual(NOW)
    expect(data.lastEncoreCount).toBe(2)
  })

  it("keeps the timer while the grace period is still running", async () => {
    const started = new Date(NOW.getTime() - 10 * 60 * 1000)
    const show = makeShow({ encoreStartedAt: started, lastEncoreCount: 1 })
    const result = await scoreShow(show, withEncore)
    const data = db.show.update.mock.calls[0][0].data
    expect(data).not.toHaveProperty("encoreStartedAt")
    expect(data.lastEncoreCount).toBe(1)
    expect(result.status).toBe("in_progress")
  })

  it("completes the show and marks submissions scored once the grace period expires", async () => {
    const show = makeShow({
      encoreStartedAt: new Date(NOW.getTime() - GRACE_PERIOD_MS),
      lastEncoreCount: 1,
    })
    show.submissions[0].lastSongCount = 3

    const result = await scoreShow(show, withEncore)

    expect(result.status).toBe("completed")
    expect(db.show.update.mock.calls[0][0].data.isComplete).toBe(true)
    // No new songs, but the submission wasn't scored yet, so it's finalized
    expect(db.submission.update.mock.calls[0][0].data.isScored).toBe(true)
  })

  it("skips submissions with no new songs before completion", async () => {
    const show = makeShow()
    show.submissions[0].lastSongCount = 2
    const result = await scoreShow(show, set1Only)
    expect(result.submissionsUpdated).toBe(0)
    expect(db.submission.update).not.toHaveBeenCalled()
  })

  it("forceComplete finalizes immediately without touching encore tracking", async () => {
    const result = await scoreShow(makeShow(), set1Only, {
      forceComplete: true,
      logPrefix: "[Admin]",
    })
    const data = db.show.update.mock.calls[0][0].data
    expect(result.status).toBe("completed")
    expect(data.isComplete).toBe(true)
    expect(data).not.toHaveProperty("encoreStartedAt")
    expect(data).not.toHaveProperty("lastEncoreCount")
    expect(db.submission.update.mock.calls[0][0].data.isScored).toBe(true)
  })

  it("passes each pick's previous wasPlayed to achievement processing", async () => {
    const show = makeShow()
    show.submissions[0].picks[0].wasPlayed = true
    await scoreShow(show, withEncore)
    const [scored] = processMock.mock.calls[0]
    expect(scored.find((p) => p.id === "pick-1")?.previousWasPlayed).toBe(true)
    expect(scored.find((p) => p.id === "pick-2")?.previousWasPlayed).toBeNull()
  })

  it("logs achievement awards and errors without failing", async () => {
    processMock.mockResolvedValueOnce({ awarded: 2, errors: 1 })
    await scoreShow(makeShow(), set1Only)
    expect(console.log).toHaveBeenCalledWith(
      expect.stringContaining("Awarded 2 achievement")
    )
    expect(console.log).toHaveBeenCalledWith(
      expect.stringContaining("1 achievement error")
    )
  })

  it("swallows achievement processing exceptions", async () => {
    processMock.mockRejectedValueOnce(new Error("kaboom"))
    const result = await scoreShow(makeShow(), set1Only)
    expect(result.submissionsUpdated).toBe(1)
    expect(console.error).toHaveBeenCalledWith(
      expect.stringContaining("Achievement processing error"),
      "kaboom"
    )

    processMock.mockRejectedValueOnce("plain")
    await scoreShow(makeShow(), set1Only)
    expect(console.error).toHaveBeenCalledWith(
      expect.stringContaining("Achievement processing error"),
      "plain"
    )
  })

  it("treats a null lastSongCount as zero", async () => {
    const show = makeShow()
    show.submissions[0].lastSongCount = null as unknown as number
    const result = await scoreShow(show, set1Only)
    expect(result.submissionsUpdated).toBe(1)
  })
})
