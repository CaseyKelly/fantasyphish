"use client"

import { useEffect } from "react"
import Link from "next/link"
import * as Sentry from "@sentry/nextjs"
import { RotateCw } from "lucide-react"
import { Button } from "@/components/ui/button"
import { DonutLogo } from "@/components/DonutLogo"
import { isTransientNetworkError } from "@/lib/network-error"

const JAM_EXCUSES = [
  "Looks like we wandered off into a Type II jam and lost the thread.",
  "Something got tangled up in the looping pedal. We're working it out.",
  "That request took an unscheduled detour into the second set.",
  "The setlist gods are feeling unpredictable today. Even for them.",
]

// Deterministic pick based on the error itself, so render stays pure
// (no Math.random / Date.now during render).
function pickExcuse(seed: string): string {
  let hash = 0
  for (let i = 0; i < seed.length; i++) {
    hash = (hash * 31 + seed.charCodeAt(i)) | 0
  }
  return JAM_EXCUSES[Math.abs(hash) % JAM_EXCUSES.length]
}

// A network blip (e.g. Safari dropping the connection while the RSC refresh
// that fires on tab return is still streaming) surfaces here as a render
// error. Retry those once on our own instead of showing the error page;
// the cooldown keeps a persistent failure from looping, and it falls through
// to the normal page + Sentry report.
const AUTO_RETRY_COOLDOWN_MS = 30_000
let lastAutoRetryAt = 0
// Keyed by error so each new error gets its own decision even when React
// keeps this boundary mounted across a failed retry
const autoRetryDecisions = new WeakMap<object, boolean>()

function shouldAutoRetry(error: Error): boolean {
  let decision = autoRetryDecisions.get(error)
  if (decision === undefined) {
    decision =
      isTransientNetworkError(error) &&
      Date.now() - lastAutoRetryAt > AUTO_RETRY_COOLDOWN_MS
    autoRetryDecisions.set(error, decision)
  }
  return decision
}

export default function Error({
  error,
  retry,
}: {
  error: Error & { digest?: string }
  // Refetches the route's server data, then resets the boundary. Plain
  // reset() would re-render the same failed payload.
  retry: () => void
}) {
  const autoRetry = shouldAutoRetry(error)

  useEffect(() => {
    if (autoRetry) {
      lastAutoRetryAt = Date.now()
      retry()
      return
    }
    console.error("[ErrorBoundary]", error)
    Sentry.captureException(error)
  }, [error, retry, autoRetry])

  // Keep the screen blank for the moment a retry takes rather than flashing
  // the error page at someone who did nothing wrong
  if (autoRetry) return null

  const excuse = pickExcuse(error.digest || error.message || "")

  return (
    <div className="min-h-[70vh] flex items-center justify-center px-4">
      <div className="max-w-md w-full text-center">
        <DonutLogo size="xl" className="mx-auto mb-6 opacity-90" />
        <h1 className="text-3xl sm:text-4xl font-bold font-display text-white mb-3">
          Well, That Was Unexpected
        </h1>
        <p className="text-gray-400 mb-8">{excuse}</p>
        <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
          <Button onClick={retry}>
            <RotateCw className="mr-2 h-4 w-4" />
            Try Again
          </Button>
          <Link href="/">
            <Button variant="outline">Back to Home</Button>
          </Link>
        </div>
      </div>
    </div>
  )
}
