import { describe, it, expect } from "vitest"
import {
  parseUTCDate,
  formatTimeOfDay,
  getHourInTimezone,
  getTimezoneAbbr,
} from "./date-utils"

describe("parseUTCDate", () => {
  it("parses an ISO string into a Date with matching year/month/day (string overload)", () => {
    const date = parseUTCDate("2025-12-28T00:00:00.000Z")
    expect(date.getFullYear()).toBe(2025)
    expect(date.getMonth()).toBe(11) // 0-indexed
    expect(date.getDate()).toBe(28)
  })

  it("parses and formats an ISO string (string + formatStr overload)", () => {
    expect(parseUTCDate("2025-07-04T00:00:00.000Z", "yyyy-MM-dd")).toBe(
      "2025-07-04"
    )
  })

  it("re-extracts date components from a Date input via its UTC representation", () => {
    const input = new Date(Date.UTC(2025, 6, 4))
    const date = parseUTCDate(input)
    expect(date.getFullYear()).toBe(2025)
    expect(date.getMonth()).toBe(6)
    expect(date.getDate()).toBe(4)
  })

  it("parses and formats a Date input (Date + formatStr overload)", () => {
    const input = new Date(Date.UTC(2025, 6, 4))
    expect(parseUTCDate(input, "yyyy-MM-dd")).toBe("2025-07-04")
  })

  it("throws for an invalid month", () => {
    expect(() => parseUTCDate("2025-13-01T00:00:00.000Z")).toThrow(
      /Invalid month value: 13/
    )
  })

  it("throws for an invalid day", () => {
    expect(() => parseUTCDate("2025-01-32T00:00:00.000Z")).toThrow(
      /Invalid day value: 32/
    )
  })

  it("throws for a day that doesn't exist in the given month (Feb 31 rollover)", () => {
    expect(() => parseUTCDate("2025-02-31T00:00:00.000Z")).toThrow(
      /does not exist/
    )
  })

  it("throws for an empty string", () => {
    expect(() => parseUTCDate("")).toThrow(/Invalid date string provided/)
  })

  it("throws for a malformed date string with non-numeric components", () => {
    expect(() => parseUTCDate("garbage-value-x")).toThrow(
      /Invalid date components/
    )
  })
})

describe("formatTimeOfDay", () => {
  it("formats an on-the-hour time without minutes", () => {
    // 00:00 UTC on 2025-01-16 is 7:00 PM ET the prior day (winter, UTC-5)
    expect(
      formatTimeOfDay(new Date("2025-01-16T00:00:00Z"), "America/New_York")
    ).toBe("7 PM")
  })

  it("formats a non-zero-minute time with minutes", () => {
    expect(
      formatTimeOfDay(new Date("2025-01-16T00:30:00Z"), "America/New_York")
    ).toBe("7:30 PM")
  })
})

describe("getHourInTimezone", () => {
  it("returns the local hour, not the UTC hour", () => {
    // Midnight UTC is 7 PM the prior day in Eastern winter time
    expect(
      getHourInTimezone(new Date("2025-01-15T00:00:00Z"), "America/New_York")
    ).toBe(19)
  })

  it("normalizes local midnight to hour 0", () => {
    // 05:00 UTC is midnight ET in winter (UTC-5)
    expect(
      getHourInTimezone(new Date("2025-01-15T05:00:00Z"), "America/New_York")
    ).toBe(0)
  })
})

describe("getTimezoneAbbr", () => {
  it("returns the abbreviation for a known timezone", () => {
    expect(getTimezoneAbbr("America/New_York")).toBe("ET")
    expect(getTimezoneAbbr("America/Los_Angeles")).toBe("PT")
  })

  it("falls back to the input string for an unknown timezone", () => {
    expect(getTimezoneAbbr("Europe/Paris")).toBe("Europe/Paris")
  })
})
