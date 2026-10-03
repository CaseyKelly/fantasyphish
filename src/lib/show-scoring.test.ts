import { describe, it, expect, vi, beforeEach } from "vitest"
import type { PhishNetSetlist, PhishNetSetlistSong } from "./phishnet"

// Record every write in order so tests can assert the show is only marked
// complete after its submissions are finalized
const calls: string[] = []

vi.mock("@/lib/prisma", () => ({
  prisma: {
    show: {
      update: vi.fn(async (args: { data: Record<string, unknown> }) => {
        calls.push(
          "isComplete" in args.data ? "show:complete" : "show:progress"
        )
      }),
    },
    pick: {
      update: vi.fn(
        (args: { where: { id: string } }) => `pick:${args.where.id}`
      ),
    },
    submission: {
      update: vi.fn(
        (args: { where: { id: string }; data: { isScored: boolean } }) =>
          `submission:${args.where.id}:${args.data.isScored ? "scored" : "live"}`
      ),
    },
    $transaction: vi.fn(async (ops: string[]) => {
      calls.push(ops[ops.length - 1])
    }),
  },
}))

vi.mock("@/lib/achievement-awards", () => ({
  processPickAchievements: vi.fn(async () => ({ awarded: 0, errors: 0 })),
}))

import {
  scoreShow,
  GRACE_PERIOD_MS,
  type ShowWithSubmissions,
} from "./show-scoring"

function makeSong(
  song: string,
  set: string,
  position: number
): PhishNetSetlistSong {
  return {
    songid: position,
    song,
    slug: song.toLowerCase(),
    position,
    set,
    isjam: 0,
    isreprise: 0,
    transition: "",
    footnote: "",
    showid: 1,
    showdate: "2026-07-24",
    venue: "Madison Square Garden",
    city: "New York",
    state: "NY",
    country: "USA",
    setlistnotes: "",
    tourname: "Summer Tour",
    tourid: 1,
  }
}

const setlist = {
  showid: 1,
  showdate: "2026-07-24",
  venue: "Madison Square Garden",
  city: "New York",
  state: "NY",
  country: "USA",
  setlistnotes: "",
  tour_name: "Summer Tour",
  tourid: 1,
  songs: [makeSong("Tweezer", "1", 1), makeSong("Loving Cup", "e", 2)],
} as PhishNetSetlist

function makeSubmission(id: string, isScored = false) {
  return {
    id,
    userId: `user-${id}`,
    isScored,
    lastSongCount: 2,
    totalPoints: 0,
    picks: [
      {
        id: `${id}-opener`,
        pickType: "OPENER",
        wasPlayed: null,
        song: { name: "Tweezer", slug: "tweezer" },
      },
    ],
  }
}

function makeShow(overrides: Partial<ShowWithSubmissions> = {}) {
  return {
    id: "show-1",
    showDate: new Date("2026-07-24T00:00:00Z"),
    venue: "Madison Square Garden",
    encoreStartedAt: null,
    lastEncoreCount: null,
    forceCompletedAt: null,
    submissions: [makeSubmission("a"), makeSubmission("b")],
    ...overrides,
  } as unknown as ShowWithSubmissions
}

beforeEach(() => {
  calls.length = 0
})

describe("scoreShow", () => {
  it("marks the show complete only after every submission is finalized", async () => {
    const show = makeShow({
      encoreStartedAt: new Date(Date.now() - GRACE_PERIOD_MS - 1000),
      lastEncoreCount: 1,
    })

    const result = await scoreShow(show, setlist)

    expect(result.status).toBe("completed")
    expect(calls).toEqual([
      "show:progress",
      "submission:a:scored",
      "submission:b:scored",
      "show:complete",
    ])
  })

  it("does not mark the show complete if a submission fails to save", async () => {
    const { prisma } = await import("@/lib/prisma")
    vi.mocked(prisma.$transaction).mockRejectedValueOnce(new Error("boom"))
    const show = makeShow({
      encoreStartedAt: new Date(Date.now() - GRACE_PERIOD_MS - 1000),
      lastEncoreCount: 1,
      submissions: [makeSubmission("a")] as ShowWithSubmissions["submissions"],
    })

    await expect(scoreShow(show, setlist)).rejects.toThrow("boom")
    expect(calls).not.toContain("show:complete")
  })

  it("finishes only still-unscored submissions on a retry run", async () => {
    const show = makeShow({
      encoreStartedAt: new Date(Date.now() - GRACE_PERIOD_MS - 1000),
      lastEncoreCount: 1,
      submissions: [
        makeSubmission("a", true),
        makeSubmission("b"),
      ] as ShowWithSubmissions["submissions"],
    })

    await scoreShow(show, setlist)

    expect(calls).toEqual([
      "show:progress",
      "submission:b:scored",
      "show:complete",
    ])
  })

  it("treats forceCompletedAt as an admin completion without waiting for the grace period", async () => {
    const show = makeShow({ forceCompletedAt: new Date() })

    const result = await scoreShow(show, setlist)

    expect(result.status).toBe("completed")
    expect(calls).toEqual([
      "show:progress",
      "submission:a:scored",
      "submission:b:scored",
      "show:complete",
    ])
  })

  it("keeps scoring live without completing while the grace period runs", async () => {
    const show = makeShow({
      encoreStartedAt: new Date(),
      lastEncoreCount: 1,
      submissions: [
        { ...makeSubmission("a"), lastSongCount: 1 },
      ] as ShowWithSubmissions["submissions"],
    })

    const result = await scoreShow(show, setlist)

    expect(result.status).toBe("in_progress")
    expect(calls).toEqual(["show:progress", "submission:a:live"])
  })
})
