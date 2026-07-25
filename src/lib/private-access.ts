/**
 * Email of the sole viewer allowed on private, owner-only pages (e.g. the
 * submissions viewer). Unrelated to `User.isAdmin`, which controls admin
 * tooling and leaderboard eligibility.
 *
 * Overridable via env so e2e tests can log in as "the owner" using a
 * disposable fixture address instead of ever writing the real email to a
 * database (see playwright.config.ts, which sets this for every test run).
 */
export const PRIVATE_VIEWER_EMAIL =
  process.env.PRIVATE_VIEWER_EMAIL?.toLowerCase() ?? "casey.kelly819@gmail.com"

export function isPrivateViewerOwner(
  email: string | null | undefined
): boolean {
  return email?.toLowerCase() === PRIVATE_VIEWER_EMAIL
}
