import { describe, it, expect } from "vitest"
import {
  SET2_OPENER_POLL,
  getPoll,
  isValidPollOption,
  summarizePollVotes,
} from "./polls"

describe("getPoll", () => {
  it("returns a known poll by slug", () => {
    expect(getPoll(SET2_OPENER_POLL.slug)).toBe(SET2_OPENER_POLL)
  })

  it("returns null for an unknown slug", () => {
    expect(getPoll("nope")).toBeNull()
  })
})

describe("isValidPollOption", () => {
  it("accepts defined option ids only", () => {
    expect(isValidPollOption(SET2_OPENER_POLL, "yes")).toBe(true)
    expect(isValidPollOption(SET2_OPENER_POLL, "no")).toBe(true)
    expect(isValidPollOption(SET2_OPENER_POLL, "maybe")).toBe(false)
  })
})

describe("summarizePollVotes", () => {
  it("returns every option at zero when there are no votes", () => {
    const results = summarizePollVotes(SET2_OPENER_POLL, [])
    expect(results.totalVotes).toBe(0)
    expect(results.options.map((o) => [o.id, o.votes, o.percent])).toEqual([
      ["yes", 0, 0],
      ["no", 0, 0],
    ])
  })

  it("computes counts and rounded percentages in definition order", () => {
    const results = summarizePollVotes(SET2_OPENER_POLL, [
      { option: "no", count: 1 },
      { option: "yes", count: 2 },
    ])
    expect(results.totalVotes).toBe(3)
    expect(results.options.map((o) => [o.id, o.votes, o.percent])).toEqual([
      ["yes", 2, 67],
      ["no", 1, 33],
    ])
  })

  it("keeps rounded percentages summing to exactly 100", () => {
    const results = summarizePollVotes(SET2_OPENER_POLL, [
      { option: "yes", count: 1 },
      { option: "no", count: 7 },
    ])
    // 12.5% / 87.5% would independently round to 13% + 88% = 101%
    const percents = results.options.map((o) => o.percent)
    expect(percents.reduce((sum, p) => sum + p, 0)).toBe(100)
    expect(percents).toEqual([13, 87])
  })

  it("ignores counts for options not in the poll", () => {
    const results = summarizePollVotes(SET2_OPENER_POLL, [
      { option: "yes", count: 1 },
      { option: "stale", count: 5 },
    ])
    expect(results.totalVotes).toBe(1)
    expect(results.options[0].percent).toBe(100)
  })
})
