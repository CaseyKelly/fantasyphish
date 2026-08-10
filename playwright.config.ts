import { defineConfig, devices } from "@playwright/test"
import dotenv from "dotenv"

// Load environment variables from .env.local for testing
dotenv.config({ path: ".env.local" })

// CRITICAL: Override DATABASE_URL with TEST_DATABASE_URL to ensure tests never touch production
if (process.env.TEST_DATABASE_URL) {
  process.env.DATABASE_URL = process.env.TEST_DATABASE_URL
  console.log("✓ Using TEST_DATABASE_URL for Playwright tests")
} else {
  const message =
    "⚠️  TEST_DATABASE_URL not set! Aborting tests to prevent possible use of production database."
  console.error(message)
  throw new Error(message)
}

// Tests need to log in as the private-viewer "owner" account, but that
// identity is a real person's email in production. Always point it at a
// disposable test fixture address here so no test run — local or CI —
// ever writes the real owner's email into any database.
process.env.PRIVATE_VIEWER_EMAIL = "owner-test-fixture@example.com"

export default defineConfig({
  testDir: "./tests/e2e",
  // Keep false: tests within a file still must run in declaration order
  // (some describe blocks share fixture rows across sibling tests). This only
  // controls whether *different files* can be handed to different workers.
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  // Spec files run concurrently against one shared database (one ephemeral
  // Neon branch per CI run), so every file must generate its own unique
  // usernames/emails/showDates rather than reusing fixed literals - see
  // uniqueUsername() in tests/e2e/helpers/fixtures.ts and the reserved-dates
  // note atop shows.spec.ts. Only the one real-Resend-send test is rate
  // sensitive, and it's a single test gated by SKIP_EMAIL_SEND, so raising
  // this doesn't multiply Resend calls. Single worker locally for simpler,
  // deterministic output during interactive debugging.
  // Dropped from 4 to 2 in CI when the webServer switched from `next dev` to
  // a real production build (`next start`): 4 concurrent Chromium instances
  // plus the production server's own footprint on the standard 2 vCPU/7GB
  // GitHub-hosted runner was causing renderer "Page crashed"/"Target
  // crashed" failures across the suite, not just the routes the build
  // switch was meant to fix.
  workers: process.env.CI ? 2 : 1,
  reporter: process.env.CI
    ? [
        ["html"],
        ["github"], // In CI: HTML report + GitHub annotations
        ["json", { outputFile: "playwright-report/report.json" }], // + machine-readable results for the PR comment
      ]
    : "list", // Locally: just list output
  globalSetup: "./tests/global-setup.ts", // Clean up test data before tests run

  use: {
    baseURL: process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000",
    // In CI, capture traces for all test runs
    trace: process.env.CI ? "on" : "off",
    screenshot: process.env.CI ? "only-on-failure" : "off",
    video: "off", // Keep video off (too large)
  },

  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],

  webServer: {
    // In CI, run the production server against a build made by the
    // "Build for E2E" workflow step, not `next dev`. Dev mode compiles each
    // route lazily on its first request, and that compile can take several
    // seconds - under CI's 4-worker parallelism, whichever route is least
    // exercised elsewhere in the suite (e.g. an admin-only API route hit by
    // only one test) risks being the one that's still cold when a test's
    // assertion timeout runs out, which is what was causing recurring
    // flaky-but-passes-on-retry reports on rarely-hit routes. A production
    // build compiles everything upfront, removing that race entirely.
    command: process.env.CI ? "npm run start" : "npm run dev",
    url: "http://localhost:3000",
    reuseExistingServer: true, // Always reuse existing server
    timeout: 120000,
  },
})
