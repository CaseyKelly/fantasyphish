import { PrismaClient } from "@prisma/client"
import { PrismaPg } from "@prisma/adapter-pg"
import dotenv from "dotenv"

// Load environment variables
dotenv.config({ path: ".env.local" })

// next dev compiles each route lazily on its first request, which can take
// several seconds - under CI's 4-worker parallelism, whichever spec file
// happens to be first (across the whole run) to hit a route that's rarely
// exercised elsewhere in the suite risked losing the race against that
// test's assertion timeout, causing recurring flaky-but-passes-on-retry
// reports (see e.g. admin.spec.ts:6, picker.spec.ts:7, admin-shows.spec.ts:14).
// Hitting each of these paths once here - before any Playwright worker
// starts - pays that one-time compile cost upfront instead of racing a test
// timeout for it. Requests are unauthenticated and mostly expected to
// 401/404/redirect - that's fine, the route module still has to compile
// before it can produce that response.
const WARMUP_PATHS = [
  "/",
  "/login",
  "/register",
  "/admin",
  "/admin/shows",
  "/admin/complete-shows",
  "/admin/usage",
  "/submissions",
  "/pick/warmup-nonexistent-show-id",
]

const WARMUP_API_REQUESTS: { path: string; init: RequestInit }[] = [
  { path: "/api/admin/delete-submission/warmup", init: { method: "DELETE" } },
  {
    path: "/api/admin/reset-show",
    init: {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ showId: "warmup" }),
    },
  },
  {
    path: "/api/admin/complete-show",
    init: {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ showId: "warmup" }),
    },
  },
]

// Bounds a single fetch with an AbortController so one hung/slow route
// can't stall globalSetup (and therefore the whole test run) indefinitely -
// there's no per-request timeout on a plain fetch() otherwise.
function fetchWithTimeout(
  url: string,
  init: RequestInit = {},
  timeoutMs = 15000
): Promise<Response> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  return fetch(url, { ...init, signal: controller.signal }).finally(() =>
    clearTimeout(timer)
  )
}

// Playwright's docs don't give a hard guarantee that webServer has finished
// starting by the time globalSetup runs (and there's open discussion in
// Playwright's own issue tracker about this), so don't assume it - poll
// until the server actually responds before firing the real warm-up
// requests. Without this, the warm-up would silently no-op via failed
// fetches on a cold server and provide zero benefit.
async function waitForServer(
  baseUrl: string,
  timeoutMs = 60000
): Promise<boolean> {
  const start = Date.now()
  while (Date.now() - start < timeoutMs) {
    try {
      await fetchWithTimeout(baseUrl, {}, 5000)
      return true
    } catch {
      await new Promise((resolve) => setTimeout(resolve, 500))
    }
  }
  return false
}

async function warmUpRoutes() {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"

  if (!(await waitForServer(baseUrl))) {
    console.warn(
      "⚠️  Dev server didn't respond in time - skipping route warm-up"
    )
    return
  }

  console.log("🔥 Warming up rarely-hit routes...")

  const requests = [
    ...WARMUP_PATHS.map((path) => fetchWithTimeout(`${baseUrl}${path}`)),
    ...WARMUP_API_REQUESTS.map(({ path, init }) =>
      fetchWithTimeout(`${baseUrl}${path}`, init)
    ),
  ]

  const results = await Promise.allSettled(requests)
  const failed = results.filter((r) => r.status === "rejected").length
  console.log(
    `✓ Warmed up ${results.length - failed}/${results.length} routes` +
      (failed > 0 ? ` (${failed} request(s) failed - non-fatal)` : "")
  )
}

async function globalSetup() {
  const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL })
  const prisma = new PrismaClient({ adapter })

  console.log("🧹 Cleaning up test shows from previous runs...")

  try {
    // Delete all shows with "test" in venue or city
    const result = await prisma.show.deleteMany({
      where: {
        OR: [
          { venue: { contains: "test", mode: "insensitive" } },
          { city: { contains: "test", mode: "insensitive" } },
        ],
      },
    })

    console.log(`✓ Deleted ${result.count} test shows`)
  } catch (error) {
    console.error("Error cleaning up test shows:", error)
  } finally {
    await prisma.$disconnect()
  }

  await warmUpRoutes()
}

export default globalSetup
