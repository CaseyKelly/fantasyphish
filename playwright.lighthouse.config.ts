import { defineConfig } from "@playwright/test"

export default defineConfig({
  webServer: {
    command: "npm run build && npm start",
    url: "http://localhost:3000",
    reuseExistingServer: false,
    timeout: 180000,
    env: {
      DATABASE_URL: process.env.DATABASE_URL || "",
      AUTH_SECRET: process.env.AUTH_SECRET || "lighthouse-test-secret",
      NEXTAUTH_SECRET: process.env.NEXTAUTH_SECRET || "lighthouse-test-secret",
      NEXT_PUBLIC_APP_URL: "http://localhost:3000",
      PHISHNET_API_KEY: process.env.PHISHNET_API_KEY || "mock-key",
      RESEND_API_KEY: process.env.RESEND_API_KEY || "re_mock_key",
    },
  },
})
