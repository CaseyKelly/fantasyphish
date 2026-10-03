import { describe, it, expect, vi } from "vitest"

// streaks.ts imports @/lib/prisma at module load; computeStreaks is pure and
// never touches it.
vi.mock("@/lib/prisma", () => ({ prisma: {} }))

import { computeStreaks, isTestVenue } from "./streaks"

const shows = ["s1", "s2", "s3", "s4", "s5", "s6"]

describe("computeStreaks", () => {
  it("returns zeros when the user has never submitted", () => {
    expect(computeStreaks(shows, new Set())).toEqual({ current: 0, best: 0 })
  })

  it("returns zeros when no shows have locked yet", () => {
    expect(computeStreaks([], new Set(["s1"]))).toEqual({ current: 0, best: 0 })
  })

  it("counts every show when the user never missed", () => {
    expect(computeStreaks(shows, new Set(shows))).toEqual({
      current: 6,
      best: 6,
    })
  })

  it("counts the current run back from the most recent locked show", () => {
    expect(computeStreaks(shows, new Set(["s1", "s4", "s5", "s6"]))).toEqual({
      current: 3,
      best: 3,
    })
  })

  it("resets current to 0 when the most recent locked show was missed but keeps best", () => {
    expect(computeStreaks(shows, new Set(["s1", "s2", "s3", "s4"]))).toEqual({
      current: 0,
      best: 4,
    })
  })

  it("keeps the longest earlier run as best when the current run is shorter", () => {
    expect(
      computeStreaks(shows, new Set(["s1", "s2", "s3", "s5", "s6"]))
    ).toEqual({ current: 2, best: 3 })
  })

  it("ignores submissions for shows that aren't in the locked list (e.g. tonight's unlocked show)", () => {
    expect(computeStreaks(["s1", "s2"], new Set(["s1", "s2", "s3"]))).toEqual({
      current: 2,
      best: 2,
    })
  })
})

describe("isTestVenue", () => {
  it("flags test-fixture venues and passes real ones", () => {
    expect(isTestVenue("Test Venue 42")).toBe(true)
    expect(isTestVenue("Madison Square Garden")).toBe(false)
  })
})
