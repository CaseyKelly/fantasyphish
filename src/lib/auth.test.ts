import { describe, it, expect, vi, beforeEach } from "vitest"

type AuthConfig = {
  providers: { authorize: (c: unknown) => Promise<unknown> }[]
  callbacks: {
    jwt: (args: Record<string, unknown>) => Promise<Record<string, unknown>>
    session: (args: Record<string, unknown>) => Promise<Record<string, unknown>>
  }
}

const captured = vi.hoisted(() => ({ config: null as unknown }))

vi.mock("next-auth", () => ({
  default: vi.fn((config: unknown) => {
    captured.config = config
    return { handlers: {}, signIn: vi.fn(), signOut: vi.fn(), auth: vi.fn() }
  }),
}))
vi.mock("next-auth/providers/credentials", () => ({
  default: (opts: unknown) => opts,
}))
vi.mock("bcryptjs", () => ({ compare: vi.fn() }))
vi.mock("./prisma", async () => {
  const { createPrismaMock } = await import("@/test-utils/prisma-mock")
  return { prisma: createPrismaMock() }
})

import { compare } from "bcryptjs"
import { prisma } from "./prisma"
import { resetPrismaMock, type PrismaMock } from "@/test-utils/prisma-mock"
import "./auth"

const db = prisma as unknown as PrismaMock
const config = captured.config as AuthConfig
const authorize = config.providers[0].authorize
const { jwt, session } = config.callbacks

beforeEach(() => {
  resetPrismaMock(db)
  vi.mocked(compare).mockReset()
})

describe("credentials authorize", () => {
  const user = {
    id: "u1",
    email: "a@b.com",
    username: "alice",
    isAdmin: false,
    emailVerified: new Date(),
    passwordHash: "hash",
  }

  it("rejects missing credentials", async () => {
    expect(await authorize({ email: "a@b.com" })).toBeNull()
    expect(await authorize(undefined)).toBeNull()
  })

  it("looks the user up by lowercased email", async () => {
    db.user.findUnique.mockResolvedValue(null)
    expect(await authorize({ email: "A@B.com", password: "pw" })).toBeNull()
    expect(db.user.findUnique).toHaveBeenCalledWith({
      where: { email: "a@b.com" },
    })
  })

  it("rejects unverified users", async () => {
    db.user.findUnique.mockResolvedValue({ ...user, emailVerified: null })
    expect(await authorize({ email: "a@b.com", password: "pw" })).toBeNull()
  })

  it("rejects a wrong password", async () => {
    db.user.findUnique.mockResolvedValue(user)
    vi.mocked(compare).mockResolvedValue(false as never)
    expect(await authorize({ email: "a@b.com", password: "pw" })).toBeNull()
  })

  it("returns the session user on success", async () => {
    db.user.findUnique.mockResolvedValue(user)
    vi.mocked(compare).mockResolvedValue(true as never)
    expect(await authorize({ email: "a@b.com", password: "pw" })).toEqual({
      id: "u1",
      email: "a@b.com",
      username: "alice",
      isAdmin: false,
      isPrivateViewer: false,
    })
  })
})

describe("jwt callback", () => {
  it("copies user fields onto the token at sign-in", async () => {
    const token = await jwt({
      token: {},
      user: {
        id: "u1",
        username: "alice",
        isAdmin: true,
        isPrivateViewer: false,
      },
    })
    expect(token).toEqual({
      id: "u1",
      username: "alice",
      isAdmin: true,
      isPrivateViewer: false,
    })
  })

  it("switches identity when impersonation starts", async () => {
    const token = await jwt({
      token: { id: "admin", username: "root", isAdmin: true },
      trigger: "update",
      session: {
        impersonating: {
          originalUserId: "admin",
          originalUsername: "root",
          originalIsAdmin: true,
          targetUserId: "u2",
          targetUsername: "bob",
          targetEmail: "b@x.com",
          targetIsAdmin: false,
        },
      },
    })
    expect(token).toEqual({
      id: "u2",
      username: "bob",
      isAdmin: false,
      impersonating: {
        originalUserId: "admin",
        originalUsername: "root",
        originalIsAdmin: true,
      },
    })
  })

  it("restores the original user when impersonation stops", async () => {
    const token = await jwt({
      token: {
        id: "u2",
        username: "bob",
        isAdmin: false,
        impersonating: {
          originalUserId: "admin",
          originalUsername: "root",
          originalIsAdmin: true,
        },
      },
      trigger: "update",
      session: { stopImpersonating: true },
    })
    expect(token).toEqual({ id: "admin", username: "root", isAdmin: true })
  })

  it("ignores stop requests when not impersonating", async () => {
    const token = await jwt({
      token: { id: "u1" },
      trigger: "update",
      session: { stopImpersonating: true },
    })
    expect(token).toEqual({ id: "u1" })
  })
})

describe("session callback", () => {
  it("exposes token fields and impersonation on the session", async () => {
    const result = await session({
      session: { user: {} },
      token: {
        id: "u2",
        username: "bob",
        isAdmin: false,
        isPrivateViewer: false,
        impersonating: { originalUserId: "admin" },
      },
    })
    expect(result).toEqual({
      user: {
        id: "u2",
        username: "bob",
        isAdmin: false,
        isPrivateViewer: false,
      },
      impersonating: { originalUserId: "admin" },
    })
  })

  it("leaves the session alone without a user", async () => {
    expect(await session({ session: {}, token: { id: "u1" } })).toEqual({})
  })
})
