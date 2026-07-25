/**
 * Email of the sole viewer allowed on private, owner-only pages (e.g. the
 * submissions viewer). Unrelated to `User.isAdmin`, which controls admin
 * tooling and leaderboard eligibility.
 */
export const PRIVATE_VIEWER_EMAIL = "casey.kelly819@gmail.com"

export function isPrivateViewerOwner(
  email: string | null | undefined
): boolean {
  return email?.toLowerCase() === PRIVATE_VIEWER_EMAIL
}
