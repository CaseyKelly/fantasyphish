/**
 * `code` NextAuth's signIn() returns when the Credentials authorize() rejects
 * a login for being rate limited. Kept in its own module so the client-side
 * login code can import it without pulling in server-only auth code.
 */
export const RATE_LIMITED_CODE = "rate_limited"
