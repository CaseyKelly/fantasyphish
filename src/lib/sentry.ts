import type * as Sentry from "@sentry/nextjs"

type DataCollection = NonNullable<
  NonNullable<Parameters<typeof Sentry.init>[0]>["dataCollection"]
>

/**
 * Sentry v11 collects far more by default than v10 did. Turn off the
 * categories that aren't key-filtered and could carry passwords or password
 * hashes. Cookies, headers, and URL query params stay on: the SDK already
 * redacts keys matching password/token/session/auth, which covers NextAuth
 * session cookies and `?token=` reset/verify links.
 */
export const sentryDataCollection: DataCollection = {
  // Login/register/reset-password request bodies carry plaintext passwords
  httpBodies: [],
  // Locals in auth code (e.g. `password`) would be captured on errors, and
  // minification defeats name-based filtering
  stackFrameVariables: false,
  // Bound Prisma params and results include `passwordHash`
  databaseQueryData: false,
}
