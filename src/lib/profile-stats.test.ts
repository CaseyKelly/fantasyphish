import { describe, it, expect } from "vitest"
import { computePickTypeStats, computeShowStreaks } from "./profile-stats"

describe("computePickTypeStats", () => {
  it("counts hits and scored picks per pick type", () => {
    const stats = computePickTypeStats([
      { pickType: "OPENER", wasPlayed: true },
      { pickType: "OPENER", wasPlayed: false },
      { pickType: "ENCORE", wasPlayed: false },
      { pickType: "REGULAR", wasPlayed: true },
      { pickType: "REGULAR", wasPlayed: true },
      { pickType: "REGULAR", wasPlayed: false },
    ])
    expect(stats).toEqual({
      OPENER: { hits: 1, scored: 2 },
      ENCORE: { hits: 0, scored: 1 },
      REGULAR: { hits: 2, scored: 3 },
    })
  })

  it("ignores picks that haven't been scored yet", () => {
    const stats = computePickTypeStats([
      { pickType: "OPENER", wasPlayed: null },
      { pickType: "REGULAR", wasPlayed: null },
      { pickType: "REGULAR", wasPlayed: true },
    ])
    expect(stats.OPENER).toEqual({ hits: 0, scored: 0 })
    expect(stats.REGULAR).toEqual({ hits: 1, scored: 1 })
  })

  it("returns zeros for no picks", () => {
    expect(computePickTypeStats([])).toEqual({
      OPENER: { hits: 0, scored: 0 },
      ENCORE: { hits: 0, scored: 0 },
      REGULAR: { hits: 0, scored: 0 },
    })
  })
})

describe("computeShowStreaks", () => {
  const shows = ["s1", "s2", "s3", "s4", "s5", "s6"]

  it("returns zeros when the user never played", () => {
    expect(computeShowStreaks(shows, new Set())).toEqual({
      current: 0,
      longest: 0,
    })
  })

  it("counts the current streak back from the most recent show", () => {
    expect(
      computeShowStreaks(shows, new Set(["s1", "s4", "s5", "s6"]))
    ).toEqual({ current: 3, longest: 3 })
  })

  it("resets the current streak when the latest show was missed", () => {
    expect(
      computeShowStreaks(shows, new Set(["s1", "s2", "s3", "s5"]))
    ).toEqual({ current: 0, longest: 3 })
  })

  it("keeps the longest streak separate from a shorter current one", () => {
    expect(
      computeShowStreaks(shows, new Set(["s1", "s2", "s3", "s4", "s6"]))
    ).toEqual({ current: 1, longest: 4 })
  })

  it("ignores played shows that aren't in the locked list", () => {
    expect(computeShowStreaks(shows, new Set(["s6", "future"]))).toEqual({
      current: 1,
      longest: 1,
    })
  })

  it("handles no locked shows", () => {
    expect(computeShowStreaks([], new Set(["s1"]))).toEqual({
      current: 0,
      longest: 0,
    })
  })
})
