import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"

const adapterArgs = vi.hoisted(() => [] as unknown[])
const clientArgs = vi.hoisted(() => [] as unknown[])

vi.mock("@prisma/adapter-pg", () => ({
  PrismaPg: vi.fn(function (opts: unknown) {
    adapterArgs.push(opts)
  }),
}))
vi.mock("@prisma/client", () => ({
  PrismaClient: vi.fn(function (opts: unknown) {
    clientArgs.push(opts)
  }),
}))

async function load(url: string | undefined) {
  vi.resetModules()
  adapterArgs.length = 0
  clientArgs.length = 0
  delete (globalThis as { prisma?: unknown }).prisma
  vi.stubEnv("DATABASE_URL", url as string)
  return import("./prisma")
}

beforeEach(() => {
  vi.stubEnv("NODE_ENV", "test")
})

afterEach(() => {
  vi.unstubAllEnvs()
  delete (globalThis as { prisma?: unknown }).prisma
})

function connectionString(): string | undefined {
  return (adapterArgs[0] as { connectionString?: string }).connectionString
}

describe("prisma client setup", () => {
  it.each(["prefer", "require", "verify-ca"])(
    "pins sslmode=%s to verify-full",
    async (mode) => {
      await load(`postgres://u:p@host/db?sslmode=${mode}`)
      expect(connectionString()).toBe(
        "postgres://u:p@host/db?sslmode=verify-full"
      )
    }
  )

  it("leaves other URLs untouched", async () => {
    await load("postgres://u:p@host/db?sslmode=disable")
    expect(connectionString()).toBe("postgres://u:p@host/db?sslmode=disable")
  })

  it("passes through unparseable and empty URLs", async () => {
    await load("not a url")
    expect(connectionString()).toBe("not a url")
    await load("")
    expect(connectionString()).toBe("")
  })

  it("caches the client on globalThis outside production", async () => {
    const mod = await load("postgres://h/db")
    expect((globalThis as { prisma?: unknown }).prisma).toBe(mod.prisma)
    expect(mod.default).toBe(mod.prisma)
    expect(clientArgs[0]).toMatchObject({ log: ["error"] })
  })

  it("logs queries in development and skips the global cache in production", async () => {
    vi.stubEnv("NODE_ENV", "development")
    await load("postgres://h/db")
    expect(clientArgs[0]).toMatchObject({ log: ["query", "error", "warn"] })

    vi.stubEnv("NODE_ENV", "production")
    await load("postgres://h/db")
    expect((globalThis as { prisma?: unknown }).prisma).toBeUndefined()
  })
})
