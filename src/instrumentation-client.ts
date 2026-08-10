import * as Sentry from "@sentry/nextjs"

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  tracesSampleRate: 0,
  ignoreErrors: [
    // Browser extension noise (e.g. Safari's extension bridge), not app code
    /Invalid call to runtime\.sendMessage\(\)\.? *Tab not found\.?/,
  ],
})

export const onRouterTransitionStart = Sentry.captureRouterTransitionStart
