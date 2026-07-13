"use client"

import { useEffect } from "react"

// Global-error replaces the root layout entirely when it throws, so it
// renders its own <html>/<body> and avoids relying on providers, fonts,
// or other app code that may be the thing that broke.
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error("[GlobalErrorBoundary]", error)
  }, [error])

  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: "#2d4654",
          color: "#fff",
          fontFamily:
            "-apple-system, BlinkMacSystemFont, Segoe UI, Roboto, sans-serif",
          padding: "1.5rem",
        }}
      >
        <div style={{ maxWidth: 420, textAlign: "center" }}>
          <svg
            viewBox="0 0 120 120"
            width={64}
            height={64}
            style={{ margin: "0 auto 1.5rem", opacity: 0.9 }}
            fill="none"
          >
            <circle
              cx="60"
              cy="60"
              r="40"
              stroke="#c23a3a"
              strokeWidth="24"
              fill="none"
            />
          </svg>
          <h1
            style={{ fontSize: "1.75rem", fontWeight: 700, marginBottom: 12 }}
          >
            The Whole Show Cut Out
          </h1>
          <p style={{ color: "#9ca3af", marginBottom: 28, lineHeight: 1.5 }}>
            Something went wrong loading FantasyPhish itself, not just this
            page. Try again — if it keeps happening, the crew has already been
            paged.
          </p>
          <button
            onClick={reset}
            style={{
              backgroundColor: "#c23a3a",
              color: "#fff",
              border: "none",
              borderRadius: 8,
              padding: "0.625rem 1.5rem",
              fontSize: "1rem",
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            Try Again
          </button>
        </div>
      </body>
    </html>
  )
}
