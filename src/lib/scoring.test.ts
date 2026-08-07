import { describe, it, expect } from "vitest"
import {
  scoreSubmission,
  scoreSubmissionProgressive,
  getPickTypeLabel,
  getPickTypePoints,
  POINTS,
  MAX_POINTS,
} from "./scoring"
import type { PhishNetSetlist, PhishNetSetlistSong } from "./phishnet"
import type { PickType } from "@prisma/client"

function makeSong(
  overrides: Partial<PhishNetSetlistSong>
): PhishNetSetlistSong {
  return {
    songid: 1,
    song: "Tweezer",
    slug: "tweezer",
    position: 1,
    set: "1",
    isjam: 0,
    isreprise: 0,
    transition: "",
    footnote: "",
    showid: 1,
    showdate: "2025-07-04",
    venue: "Test Venue",
    city: "Burlington",
    state: "VT",
    country: "USA",
    setlistnotes: "",
    tourname: "Summer Tour",
    tourid: 1,
    ...overrides,
  }
}

function makeSetlist(songs: PhishNetSetlistSong[]): PhishNetSetlist {
  return {
    showid: 1,
    showdate: "2025-07-04",
    venue: "Test Venue",
    city: "Burlington",
    state: "VT",
    country: "USA",
    setlistnotes: "",
    tour_name: "Summer Tour",
    tourid: 1,
    songs,
  }
}

function pick(
  id: string,
  pickType: PickType,
  songName: string
): { id: string; pickType: PickType; song: { name: string; slug: string } } {
  return { id, pickType, song: { name: songName, slug: songName } }
}

describe("scoreSubmission", () => {
  it("awards opener points when the opener pick matches the first set-1 song", () => {
    const setlist = makeSetlist([
      makeSong({ song: "Tweezer", position: 1, set: "1" }),
      makeSong({ song: "Sample in a Jar", position: 2, set: "1" }),
    ])
    const { scoredPicks, totalPoints } = scoreSubmission(
      [pick("p1", "OPENER", "Tweezer")],
      setlist
    )
    expect(scoredPicks[0]).toEqual({
      id: "p1",
      wasPlayed: true,
      pointsEarned: POINTS.OPENER,
    })
    expect(totalPoints).toBe(POINTS.OPENER)
  })

  it("does not award opener points when the opener pick doesn't match", () => {
    const setlist = makeSetlist([makeSong({ song: "Tweezer", set: "1" })])
    const { scoredPicks } = scoreSubmission(
      [pick("p1", "OPENER", "Bathtub Gin")],
      setlist
    )
    expect(scoredPicks[0]).toEqual({
      id: "p1",
      wasPlayed: false,
      pointsEarned: 0,
    })
  })

  it("leaves opener pick unscored (null) when set 1 hasn't started", () => {
    const setlist = makeSetlist([])
    const { scoredPicks } = scoreSubmission(
      [pick("p1", "OPENER", "Tweezer")],
      setlist
    )
    expect(scoredPicks[0].wasPlayed).toBeNull()
    expect(scoredPicks[0].pointsEarned).toBe(0)
  })

  it("awards encore points when the encore pick matches any encore-set song", () => {
    const setlist = makeSetlist([
      makeSong({ song: "Tweezer", set: "1", position: 1 }),
      makeSong({ song: "Character Zero", set: "e", position: 1 }),
      makeSong({ song: "Rocky Top", set: "e", position: 2 }),
    ])
    const { scoredPicks, totalPoints } = scoreSubmission(
      [pick("p1", "ENCORE", "Rocky Top")],
      setlist
    )
    expect(scoredPicks[0]).toEqual({
      id: "p1",
      wasPlayed: true,
      pointsEarned: POINTS.ENCORE,
    })
    expect(totalPoints).toBe(POINTS.ENCORE)
  })

  it("leaves encore pick unscored (null) when there's no encore yet", () => {
    const setlist = makeSetlist([makeSong({ song: "Tweezer", set: "1" })])
    const { scoredPicks } = scoreSubmission(
      [pick("p1", "ENCORE", "Rocky Top")],
      setlist
    )
    expect(scoredPicks[0].wasPlayed).toBeNull()
    expect(scoredPicks[0].pointsEarned).toBe(0)
  })

  it("awards regular points when a regular pick is played anywhere in the show", () => {
    const setlist = makeSetlist([
      makeSong({ song: "Tweezer", set: "1", position: 1 }),
      makeSong({ song: "Harry Hood", set: "2", position: 5 }),
    ])
    const { scoredPicks, totalPoints } = scoreSubmission(
      [pick("p1", "REGULAR", "Harry Hood")],
      setlist
    )
    expect(scoredPicks[0]).toEqual({
      id: "p1",
      wasPlayed: true,
      pointsEarned: POINTS.REGULAR,
    })
    expect(totalPoints).toBe(POINTS.REGULAR)
  })

  it("scores duplicate picks of the same song independently", () => {
    const setlist = makeSetlist([makeSong({ song: "Harry Hood", set: "2" })])
    const { scoredPicks, totalPoints } = scoreSubmission(
      [
        pick("p1", "REGULAR", "Harry Hood"),
        pick("p2", "REGULAR", "Harry Hood"),
      ],
      setlist
    )
    expect(scoredPicks).toHaveLength(2)
    expect(scoredPicks[0].wasPlayed).toBe(true)
    expect(scoredPicks[1].wasPlayed).toBe(true)
    expect(totalPoints).toBe(POINTS.REGULAR * 2)
  })

  it("matches songs regardless of case/punctuation differences", () => {
    const setlist = makeSetlist([
      makeSong({ song: "Tweezer's Reprise", set: "2" }),
    ])
    const { scoredPicks } = scoreSubmission(
      [pick("p1", "REGULAR", "tweezers reprise!!")],
      setlist
    )
    expect(scoredPicks[0].wasPlayed).toBe(true)
  })

  it("awards the full 17-point max when opener, encore, and all 11 regular picks hit", () => {
    const regularSongs = Array.from({ length: 11 }, (_, i) => `Song ${i}`)
    const setlist = makeSetlist([
      makeSong({ song: "Opener Song", set: "1", position: 1 }),
      ...regularSongs.map((name, i) =>
        makeSong({ song: name, set: "2", position: i + 1 })
      ),
      makeSong({ song: "Encore Song", set: "e", position: 1 }),
    ])
    const picks = [
      pick("opener", "OPENER", "Opener Song"),
      pick("encore", "ENCORE", "Encore Song"),
      ...regularSongs.map((name, i) => pick(`r${i}`, "REGULAR", name)),
    ]
    const { totalPoints } = scoreSubmission(picks, setlist)
    expect(totalPoints).toBe(MAX_POINTS)
    expect(totalPoints).toBe(17)
  })
})

describe("scoreSubmissionProgressive", () => {
  it("marks the show complete once an encore-set song appears", () => {
    const setlist = makeSetlist([
      makeSong({ song: "Tweezer", set: "1" }),
      makeSong({ song: "Character Zero", set: "E" }),
    ])
    const result = scoreSubmissionProgressive([], setlist)
    expect(result.isComplete).toBe(true)
  })

  it("is not complete without any encore-set song", () => {
    const setlist = makeSetlist([makeSong({ song: "Tweezer", set: "1" })])
    const result = scoreSubmissionProgressive([], setlist)
    expect(result.isComplete).toBe(false)
  })

  it("reports hasNewSongs true only once song count exceeds previousSongCount", () => {
    const setlist = makeSetlist([
      makeSong({ song: "Tweezer", set: "1" }),
      makeSong({ song: "Sample in a Jar", set: "1" }),
    ])
    expect(scoreSubmissionProgressive([], setlist, 2).hasNewSongs).toBe(false)
    expect(scoreSubmissionProgressive([], setlist, 1).hasNewSongs).toBe(true)
  })

  it("is idempotent: rescoring with an unchanged setlist returns the same totals", () => {
    const setlist = makeSetlist([makeSong({ song: "Harry Hood", set: "2" })])
    const picks = [pick("p1", "REGULAR", "Harry Hood")]
    const first = scoreSubmissionProgressive(picks, setlist, 0)
    const second = scoreSubmissionProgressive(
      picks,
      setlist,
      first.currentSongCount
    )
    expect(second.totalPoints).toBe(first.totalPoints)
    expect(second.scoredPicks).toEqual(first.scoredPicks)
    expect(second.hasNewSongs).toBe(false)
  })

  it("reflects setlist growth in currentSongCount", () => {
    const setlist = makeSetlist([
      makeSong({ song: "Tweezer", set: "1" }),
      makeSong({ song: "Sample in a Jar", set: "1" }),
      makeSong({ song: "Harry Hood", set: "2" }),
    ])
    const result = scoreSubmissionProgressive([], setlist, 1)
    expect(result.currentSongCount).toBe(3)
  })
})

describe("getPickTypeLabel / getPickTypePoints", () => {
  it.each([
    ["OPENER", "Opener", POINTS.OPENER],
    ["ENCORE", "Encore", POINTS.ENCORE],
    ["REGULAR", "Regular", POINTS.REGULAR],
  ] as const)("%s -> %s / %d points", (pickType, label, points) => {
    expect(getPickTypeLabel(pickType)).toBe(label)
    expect(getPickTypePoints(pickType)).toBe(points)
  })

  it("falls back to Unknown/0 for an unrecognized pick type", () => {
    const bogus = "SOMETHING_ELSE" as PickType
    expect(getPickTypeLabel(bogus)).toBe("Unknown")
    expect(getPickTypePoints(bogus)).toBe(0)
  })
})
