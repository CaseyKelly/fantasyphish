import { fromZonedTime } from "date-fns-tz"

// Map US states/provinces to IANA timezones
const TIMEZONE_MAP: Record<string, string> = {
  // Eastern Time
  CT: "America/New_York",
  DE: "America/New_York",
  FL: "America/New_York", // Most of FL
  GA: "America/New_York",
  MA: "America/New_York",
  MD: "America/New_York",
  ME: "America/New_York",
  NC: "America/New_York",
  NH: "America/New_York",
  NJ: "America/New_York",
  NY: "America/New_York",
  OH: "America/New_York",
  PA: "America/New_York",
  RI: "America/New_York",
  SC: "America/New_York",
  VA: "America/New_York",
  VT: "America/New_York",
  WV: "America/New_York",
  DC: "America/New_York",

  // Central Time
  AL: "America/Chicago",
  AR: "America/Chicago",
  IA: "America/Chicago",
  IL: "America/Chicago",
  IN: "America/Chicago", // Most of IN
  KS: "America/Chicago",
  KY: "America/Chicago", // Most of KY
  LA: "America/Chicago",
  MN: "America/Chicago",
  MO: "America/Chicago",
  MS: "America/Chicago",
  ND: "America/Chicago",
  NE: "America/Chicago",
  OK: "America/Chicago",
  SD: "America/Chicago",
  TN: "America/Chicago",
  TX: "America/Chicago",
  WI: "America/Chicago",

  // Mountain Time
  AZ: "America/Phoenix", // AZ doesn't observe DST
  CO: "America/Denver",
  ID: "America/Denver",
  MT: "America/Denver",
  NM: "America/Denver",
  UT: "America/Denver",
  WY: "America/Denver",

  // Pacific Time
  CA: "America/Los_Angeles",
  NV: "America/Los_Angeles",
  OR: "America/Los_Angeles",
  WA: "America/Los_Angeles",

  // Alaska Time
  AK: "America/Anchorage",

  // Hawaii Time
  HI: "America/Honolulu",

  // Canadian provinces
  AB: "America/Edmonton",
  BC: "America/Vancouver",
  MB: "America/Winnipeg",
  NB: "America/Halifax",
  NL: "America/St_Johns",
  NS: "America/Halifax",
  NT: "America/Yellowknife",
  NU: "America/Iqaluit",
  ON: "America/Toronto",
  PE: "America/Halifax",
  QC: "America/Montreal",
  SK: "America/Regina",
  YT: "America/Whitehorse",

  // Common international locations
  UK: "Europe/London",
  England: "Europe/London",
  "United Kingdom": "Europe/London",
  Mexico: "America/Mexico_City",
  Japan: "Asia/Tokyo",
}

/**
 * Get IANA timezone identifier for a location
 * Defaults to America/New_York if not found
 */
export function getTimezoneForLocation(state?: string | null): string {
  if (!state) {
    return "America/New_York" // Default to Eastern
  }

  const tz = TIMEZONE_MAP[state.toUpperCase()]
  return tz || "America/New_York"
}

/**
 * Calculate the lock time for a show (7 PM in the venue's timezone)
 * Returns a UTC Date object
 */
export function getShowLockTime(showDate: Date, timezone: string): Date {
  // Get the date components in UTC to avoid timezone conversion issues
  const year = showDate.getUTCFullYear()
  const month = showDate.getUTCMonth() + 1
  const day = showDate.getUTCDate()

  // Create a date at 7 PM in the show's timezone
  const lockTimeInVenueTz = new Date(year, month - 1, day, 19, 0, 0, 0)

  // Convert 7 PM in venue timezone to UTC
  return fromZonedTime(lockTimeInVenueTz, timezone)
}

/**
 * Check if a show is locked (current time >= lock time)
 */
export function isShowLocked(lockTime: Date): boolean {
  return new Date() >= lockTime
}

/**
 * Calculate and check if a show is locked based on its date and timezone
 */
export function calculateIsShowLocked(
  showDate: Date,
  timezone?: string | null,
  state?: string | null
): boolean {
  const tz = timezone || getTimezoneForLocation(state)
  const lockTime = getShowLockTime(showDate, tz)
  return isShowLocked(lockTime)
}
