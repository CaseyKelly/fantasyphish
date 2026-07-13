"use client"

import { useEffect } from "react"
import Link from "next/link"
import { RotateCw } from "lucide-react"
import { Button } from "@/components/ui/button"
import { DonutLogo } from "@/components/DonutLogo"

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

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error("[ErrorBoundary]", error)
  }, [error])

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
          <Button onClick={reset}>
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
