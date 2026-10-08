import { timingSafeEqual } from "crypto"
import { NextResponse } from "next/server"

/**
 * Authorize a cron/maintenance request by its `Authorization: Bearer
 * <CRON_SECRET>` header. Vercel sends this header on every cron invocation
 * when `CRON_SECRET` is set on the project, and manual triggers (e.g.
 * `npm run watch:scoring`) send it too.
 *
 * Fails closed: if `CRON_SECRET` is unset, every request is rejected. The
 * `User-Agent` header is never trusted, since any caller can set it.
 *
 * Returns `null` when authorized, or an error response to return as-is.
 */
export function verifyCronRequest(
  request: Request,
  logPrefix: string
): NextResponse | null {
  const cronSecret = process.env.CRON_SECRET

  if (!cronSecret) {
    console.error(`${logPrefix} ✗ CRON_SECRET not configured`)
    return NextResponse.json(
      { error: "CRON_SECRET not configured" },
      { status: 500 }
    )
  }

  const authHeader = request.headers.get("authorization") ?? ""
  const expected = Buffer.from(`Bearer ${cronSecret}`)
  const actual = Buffer.from(authHeader)

  if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) {
    console.error(`${logPrefix} ✗ Unauthorized request`)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  return null
}
