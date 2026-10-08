import { PrismaClient } from "@prisma/client"
import { PrismaPg } from "@prisma/adapter-pg"

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

// pg treats sslmode=prefer/require/verify-ca as verify-full today, but logs a
// SECURITY WARNING on every cold start until the mode is explicit. Pin
// verify-full to keep the current behavior and silence the warning.
function withExplicitSslMode(url: string | undefined): string | undefined {
  if (!url) return url
  try {
    const parsed = new URL(url)
    const mode = parsed.searchParams.get("sslmode")
    if (mode === "prefer" || mode === "require" || mode === "verify-ca") {
      parsed.searchParams.set("sslmode", "verify-full")
      return parsed.toString()
    }
  } catch {
    // Not a parseable URL; let pg report it
  }
  return url
}

const adapter = new PrismaPg({
  connectionString: withExplicitSslMode(process.env.DATABASE_URL),
})

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    adapter,
    log:
      process.env.NODE_ENV === "development"
        ? ["query", "error", "warn"]
        : ["error"],
  })

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma

export default prisma
