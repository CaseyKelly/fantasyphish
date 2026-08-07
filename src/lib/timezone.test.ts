import { describe, it, expect, vi, afterEach } from "vitest"
import {
  getTimezoneForLocation,
  getShowLockTime,
  isShowLocked,
  calculateIsShowLocked,
} from "./timezone"

describe("getTimezoneForLocation", () => {
  it("maps a known state code to its IANA timezone", () => {
    expect(getTimezoneForLocation("NY")).toBe("America/New_York")
  })

  it("is case-insensitive", () => {
    expect(getTimezoneForLocation("ny")).toBe("America/New_York")
    expect(getTimezoneForLocation("Ny")).toBe("America/New_York")
  })

  it("falls back to America/New_York for an unmapped code", () => {
    expect(getTimezoneForLocation("ZZ")).toBe("America/New_York")
  })

  it("falls back to America/New_York for missing input", () => {
    expect(getTimezoneForLocation(null)).toBe("America/New_York")
    expect(getTimezoneForLocation(undefined)).toBe("America/New_York")
    expect(getTimezoneForLocation("")).toBe("America/New_York")
  })
})

describe("getShowLockTime", () => {
  it("converts 7 PM Eastern to the correct UTC offset during standard time (EST, UTC-5)", () => {
    const showDate = new Date("2025-01-15T00:00:00Z")
    const lockTime = getShowLockTime(showDate, "America/New_York")
    expect(lockTime.toISOString()).toBe("2025-01-16T00:00:00.000Z")
  })

  it("converts 7 PM Eastern to the correct UTC offset during daylight time (EDT, UTC-4)", () => {
    const showDate = new Date("2025-07-04T00:00:00Z")
    const lockTime = getShowLockTime(showDate, "America/New_York")
    expect(lockTime.toISOString()).toBe("2025-07-04T23:00:00.000Z")
  })

  it("uses a constant UTC offset year-round for a zone with no DST (America/Phoenix)", () => {
    const winter = getShowLockTime(
      new Date("2025-01-15T00:00:00Z"),
      "America/Phoenix"
    )
    const summer = getShowLockTime(
      new Date("2025-07-04T00:00:00Z"),
      "America/Phoenix"
    )
    expect(winter.toISOString()).toBe("2025-01-16T02:00:00.000Z")
    expect(summer.toISOString()).toBe("2025-07-05T02:00:00.000Z")
  })

  it("uses the correct offset for a show the day before the US spring-forward transition (2025-03-09)", () => {
    const lockTime = getShowLockTime(
      new Date("2025-03-08T00:00:00Z"),
      "America/New_York"
    )
    expect(lockTime.toISOString()).toBe("2025-03-09T00:00:00.000Z")
  })

  it("uses the correct offset for a show on the US spring-forward transition day (2025-03-09)", () => {
    const lockTime = getShowLockTime(
      new Date("2025-03-09T00:00:00Z"),
      "America/New_York"
    )
    expect(lockTime.toISOString()).toBe("2025-03-09T23:00:00.000Z")
  })

  it("uses the correct offset for a show on the US fall-back transition day (2025-11-02)", () => {
    const lockTime = getShowLockTime(
      new Date("2025-11-02T00:00:00Z"),
      "America/New_York"
    )
    expect(lockTime.toISOString()).toBe("2025-11-03T00:00:00.000Z")
  })

  it("derives the show date from UTC components, ignoring the input Date's time-of-day", () => {
    const lockTime = getShowLockTime(
      new Date("2025-07-04T23:59:59Z"),
      "America/New_York"
    )
    expect(lockTime.toISOString()).toBe("2025-07-04T23:00:00.000Z")
  })
})

describe("isShowLocked", () => {
  afterEach(() => {
    vi.useRealTimers()
  })

  it("is true once now has passed the lock time", () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date("2025-07-04T23:00:01Z"))
    expect(isShowLocked(new Date("2025-07-04T23:00:00Z"))).toBe(true)
  })

  it("is false before the lock time", () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date("2025-07-04T22:59:59Z"))
    expect(isShowLocked(new Date("2025-07-04T23:00:00Z"))).toBe(false)
  })
})

describe("calculateIsShowLocked", () => {
  afterEach(() => {
    vi.useRealTimers()
  })

  it("prefers an explicit timezone over a state-derived lookup", () => {
    vi.useFakeTimers()
    // 7 PM Pacific is 3 hours after 7 PM Eastern; pick a "now" between the
    // two lock times so the two timezones disagree on whether it's locked.
    vi.setSystemTime(new Date("2025-07-05T01:00:00Z")) // 9 PM ET / 6 PM PT
    const showDate = new Date("2025-07-04T00:00:00Z")
    // state=NY would map to Eastern (already locked); explicit PT should win and not be locked yet
    expect(calculateIsShowLocked(showDate, "America/Los_Angeles", "NY")).toBe(
      false
    )
  })

  it("falls back through state, then the America/New_York default, when timezone is absent", () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date("2025-01-16T00:00:01Z"))
    const showDate = new Date("2025-01-15T00:00:00Z")
    expect(calculateIsShowLocked(showDate, null, null)).toBe(true)
  })
})
