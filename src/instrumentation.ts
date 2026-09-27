import * as Sentry from "@sentry/nextjs"
import { sentryDataCollection } from "@/lib/sentry"

export function register(): void {
  if (
    process.env.NEXT_RUNTIME === "nodejs" ||
    process.env.NEXT_RUNTIME === "edge"
  ) {
    Sentry.init({
      dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
      tracesSampleRate: 0,
      dataCollection: sentryDataCollection,
    })
  }
}

export const onRequestError = Sentry.captureRequestError
