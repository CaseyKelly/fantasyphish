/**
 * Picks which database `prisma migrate deploy` (and the build's lock
 * recovery) should talk to.
 *
 * On Vercel, the Neon integration gives each preview deployment its own
 * `DATABASE_URL` (a per-git-branch Neon branch), but `DIRECT_URL` is a
 * single project-wide env var pointing at production. Migrating via
 * `DIRECT_URL` therefore applied every PR's pending migrations to prod on
 * its first preview deploy while the preview app - which reads
 * `DATABASE_URL` - never got them. So on Vercel we migrate the same database
 * the app will read (`DATABASE_URL`), swapped to Neon's direct host because
 * migrate needs a non-pooled connection (see CLAUDE.md).
 *
 * Off Vercel (local dev, GitHub Actions), `DIRECT_URL` is set per
 * environment and stays preferred.
 */

export interface MigrationTarget {
  url: string | undefined
  // Set when migrations must not run at all, with the reason to log.
  skipReason?: string
}

type Env = Record<string, string | undefined>

// Neon pooled hosts look like `ep-foo-123-pooler.region.aws.neon.tech`; the
// direct host for the same endpoint drops the `-pooler` suffix.
export function toDirectNeonUrl(url: string): string {
  try {
    const parsed = new URL(url)
    const [first, ...rest] = parsed.hostname.split(".")
    if (!first.endsWith("-pooler")) return url
    parsed.hostname = [first.slice(0, -"-pooler".length), ...rest].join(".")
    return parsed.toString()
  } catch {
    return url
  }
}

function hostOf(url: string | undefined): string | null {
  if (!url) return null
  try {
    return new URL(toDirectNeonUrl(url)).hostname
  } catch {
    return null
  }
}

export function resolveMigrationTarget(env: Env): MigrationTarget {
  if (!env.VERCEL) {
    return { url: env.DIRECT_URL || env.DATABASE_URL }
  }

  const url = env.DATABASE_URL ? toDirectNeonUrl(env.DATABASE_URL) : undefined

  // Safety net: a preview build must never migrate production. If the
  // preview's DATABASE_URL resolves to the same host as the project-wide
  // DIRECT_URL (prod), the per-branch database wasn't provisioned for this
  // deployment - skip rather than apply unmerged migrations to prod.
  if (env.VERCEL_ENV === "preview") {
    const targetHost = hostOf(url)
    const prodHost = hostOf(env.DIRECT_URL)
    if (!targetHost) {
      return { url, skipReason: "DATABASE_URL is not set" }
    }
    if (prodHost && targetHost === prodHost) {
      return {
        url,
        skipReason: `preview DATABASE_URL points at the production database (${targetHost})`,
      }
    }
  }

  return { url: url || env.DIRECT_URL }
}

// Endpoint host only - safe to print in build logs (no credentials).
export function describeMigrationTarget(target: MigrationTarget): string {
  return hostOf(target.url) ?? "(none)"
}
