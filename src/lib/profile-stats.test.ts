import { describe, it, expect } from "vitest"
import { computePickBreakdown, type ProfileStatsPick } from "./profile-stats"

function pick(
  pickType: ProfileStatsPick["pickType"],
  songName: string,
  wasPlayed: boolean | null
): ProfileStatsPick {
  return { pickType, wasPlayed, song: { id: songName, name: songName } }
}

describe("computePickBreakdown", () => {
  it("returns zeros and nulls for a user with no submissions", () => {
    expect(computePickBreakdown([])).toEqual({
      opener: { hits: 0, attempts: 0, rate: 0 },
      encore: { hits: 0, attempts: 0, rate: 0 },
      regular: { hits: 0, attempts: 0, rate: 0 },
      bookendShows: 0,
      mostHitsInShow: 0,
      uniqueSongsPicked: 0,
      favoriteSong: null,
      mostReliableSong: null,
    })
  })

  it("splits hits and attempts by pick type", () => {
    const result = computePickBreakdown([
      {
        picks: [
          pick("OPENER", "Tweezer", true),
          pick("ENCORE", "Loving Cup", false),
          pick("REGULAR", "Ghost", true),
          pick("REGULAR", "Sand", false),
          pick("REGULAR", "Fee", null),
        ],
      },
      {
        picks: [
          pick("OPENER", "Llama", false),
          pick("ENCORE", "Tweezer Reprise", true),
          pick("REGULAR", "Ghost", true),
        ],
      },
    ])

    expect(result.opener).toEqual({ hits: 1, attempts: 2, rate: 50 })
    expect(result.encore).toEqual({ hits: 1, attempts: 2, rate: 50 })
    expect(result.regular).toEqual({ hits: 2, attempts: 4, rate: 50 })
    expect(result.mostHitsInShow).toBe(2)
    expect(result.uniqueSongsPicked).toBe(7)
  })

  it("counts bookend shows only when opener and an encore both hit", () => {
    const result = computePickBreakdown([
      {
        picks: [pick("OPENER", "Tweezer", true), pick("ENCORE", "Slave", true)],
      },
      {
        picks: [
          pick("OPENER", "Tweezer", true),
          pick("ENCORE", "Slave", false),
        ],
      },
      {
        picks: [
          pick("OPENER", "Tweezer", false),
          pick("ENCORE", "Slave", true),
        ],
      },
    ])
    expect(result.bookendShows).toBe(1)
  })

  it("picks the favorite song by pick count and the most reliable by hits", () => {
    const result = computePickBreakdown([
      {
        picks: [pick("REGULAR", "Fee", false), pick("REGULAR", "Ghost", true)],
      },
      {
        picks: [pick("REGULAR", "Fee", false), pick("REGULAR", "Ghost", true)],
      },
      { picks: [pick("REGULAR", "Fee", false)] },
    ])
    expect(result.favoriteSong).toEqual({ name: "Fee", count: 3 })
    expect(result.mostReliableSong).toEqual({ name: "Ghost", count: 2 })
  })

  it("breaks favorite-song ties by hits, then alphabetically", () => {
    const result = computePickBreakdown([
      {
        picks: [
          pick("REGULAR", "Sand", false),
          pick("REGULAR", "Ghost", true),
          pick("REGULAR", "Bathtub Gin", false),
        ],
      },
    ])
    expect(result.favoriteSong).toEqual({ name: "Ghost", count: 1 })

    const alpha = computePickBreakdown([
      {
        picks: [pick("REGULAR", "Sand", false), pick("REGULAR", "Fee", false)],
      },
    ])
    expect(alpha.favoriteSong).toEqual({ name: "Fee", count: 1 })
    expect(alpha.mostReliableSong).toBeNull()
  })
})
