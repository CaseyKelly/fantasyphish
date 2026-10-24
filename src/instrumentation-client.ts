import * as Sentry from "@sentry/nextjs"
import { isGoogleRendererNoise, sentryDataCollection } from "@/lib/sentry"

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  tracesSampleRate: 0,
  dataCollection: sentryDataCollection,
  ignoreErrors: [
    // Browser extension noise (e.g. Safari's extension bridge), not app code
    /Invalid call to runtime\.sendMessage\(\)\.? *Tab not found\.?/,
    // Service worker registration fails in some crawler/bot sandboxes (e.g. Baiduspider-render)
    // that can't complete the fetch; not actionable and not real-user-impacting.
    // Scoped to this specific fetch-failure variant so real SW registration
    // regressions (bad MIME type, 404, etc.) still surface.
    /Failed to register a ServiceWorker.*An unknown error occurred when fetching the script/,
    // WebKit's wording for the same class of failure (seen from Mobile Safari
    // UI/WKWebView, i.e. in-app browsers / PWA containers with flaky SW
    // support). Scoped to our own sw.js path so unrelated script load
    // failures still surface.
    /Script https?:\/\/[^/]+\/serwist\/sw\.js load failed/,
    // Headless checks hitting per-deployment *.vercel.app URLs get sw.js
    // redirected by Vercel deployment protection. Scoped to those hosts so a
    // redirect on the real domain still surfaces.
    /Failed to register a ServiceWorker for scope \('https:\/\/[^/']+\.vercel\.app\/'\).*behind a redirect/,
    // Some crawlers (e.g. VibedProjectsBot) stub navigator.serviceWorker.register
    // to resolve undefined instead of a ServiceWorkerRegistration, so Serwist's
    // `this._registration.waiting` throws. A real browser can't produce this,
    // and Serwist is the only code that reads `.waiting`.
    /Cannot read properties of undefined \(reading 'waiting'\)/,
    // Facebook's in-app browser injects a script that assumes a WKWebView
    // message bridge exists
    /window\.webkit\.messageHandlers/,
  ],
  // Safari hides extension script URLs behind this scheme; their messaging
  // errors ("Port ... not found", "Request timeout for contentScriptLoaded")
  // aren't ours
  denyUrls: [/^webkit-masked-url:\/\//],
  beforeSend: (event) => (isGoogleRendererNoise(event) ? null : event),
})

export const onRouterTransitionStart = Sentry.captureRouterTransitionStart
