// Grace period after encore detection before a show is auto-marked complete
// (60 minutes, in milliseconds). Kept in its own module (no server-only
// imports) so it can be shared by server code (src/lib/show-scoring.ts) and
// client components that display a countdown (e.g. the admin shows page).
export const GRACE_PERIOD_MS = 60 * 60 * 1000
