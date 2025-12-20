import { format } from "date-fns"

// Timezone abbreviation mapping
const TIMEZONE_ABBR: Record<string, string> = {
  "America/New_York": "ET",
  "America/Chicago": "CT",
  "America/Denver": "MT",
  "America/Los_Angeles": "PT",
  "America/Phoenix": "MST",
  "America/Anchorage": "AKT",
  "America/Honolulu": "HST",
}

/**
 * Get timezone abbreviation for a given IANA timezone identifier
 * Falls back to the full timezone string if no abbreviation is found
 */
export function getTimezoneAbbr(timezone: string): string {
  return TIMEZONE_ABBR[timezone] || timezone
}

/**
 * Parse an ISO date string to a Date object in UTC
 * This avoids timezone conversion issues by parsing the date components directly
 *
 * @param isoDateString - ISO date string (e.g., "2025-12-28T00:00:00.000Z")
 * @returns Date object
 */
export function parseUTCDate(isoDateString: string): Date
/**
 * Parse an ISO date string and format it
 *
 * @param isoDateString - ISO date string (e.g., "2025-12-28T00:00:00.000Z")
 * @param formatStr - Format string for date-fns format function
 * @returns Formatted date string
 */
export function parseUTCDate(isoDateString: string, formatStr: string): string
export function parseUTCDate(
  isoDateString: string,
  formatStr?: string
): Date | string {
  // Validate input
  if (!isoDateString || typeof isoDateString !== "string") {
    throw new Error("Invalid date string provided")
  }

  // Extract YYYY-MM-DD from ISO string
  const datePart = isoDateString.split("T")[0]
  const [yearStr, monthStr, dayStr] = datePart.split("-")

  // Validate extracted components
  const year = parseInt(yearStr, 10)
  const month = parseInt(monthStr, 10)
  const day = parseInt(dayStr, 10)

  if (isNaN(year) || isNaN(month) || isNaN(day)) {
    throw new Error(`Invalid date components: ${datePart}`)
  }

  if (month < 1 || month > 12) {
    throw new Error(`Invalid month value: ${month}`)
  }

  if (day < 1 || day > 31) {
    throw new Error(`Invalid day value: ${day}`)
  }

  // Create date object (month is 0-indexed in JavaScript Date)
  const dateObj = new Date(year, month - 1, day)

  // Return formatted string or Date object
  return formatStr ? format(dateObj, formatStr) : dateObj
}
