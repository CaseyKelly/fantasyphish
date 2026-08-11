import * as Sentry from "@sentry/nextjs"

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  tracesSampleRate: 0,
  ignoreErrors: [
    // Browser extension noise (e.g. Safari's extension bridge), not app code
    /Invalid call to runtime\.sendMessage\(\)\.? *Tab not found\.?/,
    // Service worker registration fails in some crawler/bot sandboxes (e.g. Baiduspider-render)
    // that can't complete the fetch; not actionable and not real-user-impacting.
    // Scoped to this specific fetch-failure variant so real SW registration
    // regressions (bad MIME type, 404, etc.) still surface.
    /Failed to register a ServiceWorker.*An unknown error occurred when fetching the script/,
  ],
})

export const onRouterTransitionStart = Sentry.captureRouterTransitionStart
