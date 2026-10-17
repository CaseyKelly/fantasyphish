import { afterEach } from "vitest"

// DOM-only setup: jsdom test files opt in with a
// `// @vitest-environment jsdom` docblock; node tests skip this entirely.
if (typeof window !== "undefined") {
  await import("@testing-library/jest-dom/vitest")
  const { cleanup } = await import("@testing-library/react")
  afterEach(() => {
    cleanup()
  })
}
