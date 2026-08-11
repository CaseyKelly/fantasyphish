import * as Sentry from "@sentry/nextjs"

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  tracesSampleRate: 0,
  ignoreErrors: [
    // Browser extension noise (e.g. Safari's extension bridge), not app code
    /Invalid call to runtime\.sendMessage\(\)\.? *Tab not found\.?/,
    // Service worker registration fails in some crawler/bot sandboxes (e.g. Baiduspider-render)
    // that can't complete the fetch; not actionable and not real-user-impacting
    /Failed to register a ServiceWorker/,
  ],
})

export const onRouterTransitionStart = Sentry.captureRouterTransitionStart
