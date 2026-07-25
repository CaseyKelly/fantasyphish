/**
 * Email of the sole viewer allowed on private, owner-only pages (e.g. the
 * submissions viewer). Unrelated to `User.isAdmin`, which controls admin
 * tooling and leaderboard eligibility.
 *
 * Must be set via env (never hardcoded) so the address never lives in
 * source. e2e tests point this at a disposable fixture address instead of
 * the real email (see playwright.config.ts, which sets this for every test
 * run). If unset, no one matches — fails closed rather than granting access
 * to everyone.
 */
export const PRIVATE_VIEWER_EMAIL =
  process.env.PRIVATE_VIEWER_EMAIL?.toLowerCase()

if (!PRIVATE_VIEWER_EMAIL) {
  console.error(
    "PRIVATE_VIEWER_EMAIL is not set in environment variables — private owner-only pages will be inaccessible to everyone"
  )
}

export function isPrivateViewerOwner(
  email: string | null | undefined
): boolean {
  if (!PRIVATE_VIEWER_EMAIL) {
    return false
  }
  return email?.toLowerCase() === PRIVATE_VIEWER_EMAIL
}
