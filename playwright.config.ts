import { defineConfig, devices } from "@playwright/test"
import dotenv from "dotenv"

// Load environment variables from .env.local for testing
dotenv.config({ path: ".env.local" })

export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: false, // Run tests sequentially to avoid rate limiting
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: 1, // Always use 1 worker to avoid Resend API rate limits
  reporter: process.env.CI
    ? [["html"], ["github"]] // In CI: HTML report + GitHub annotations
    : "list", // Locally: just list output

  use: {
    baseURL: process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000",
    // In CI, always capture traces (retain all on success, all on failure)
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
    command: "npm run dev",
    url: "http://localhost:3000",
    reuseExistingServer: true, // Always reuse existing server
    timeout: 120000,
  },
})
