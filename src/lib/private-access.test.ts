import { describe, it, expect, vi, afterEach } from "vitest"

async function loadWithEnv(email: string | undefined) {
  vi.resetModules()
  if (email === undefined) {
    delete process.env.PRIVATE_VIEWER_EMAIL
  } else {
    process.env.PRIVATE_VIEWER_EMAIL = email
  }
  return await import("./private-access")
}

describe("isPrivateViewerOwner", () => {
  const originalEnv = process.env.PRIVATE_VIEWER_EMAIL

  afterEach(() => {
    if (originalEnv === undefined) {
      delete process.env.PRIVATE_VIEWER_EMAIL
    } else {
      process.env.PRIVATE_VIEWER_EMAIL = originalEnv
    }
  })

  it("matches the exact configured email", async () => {
    const { isPrivateViewerOwner } = await loadWithEnv("owner@example.com")
    expect(isPrivateViewerOwner("owner@example.com")).toBe(true)
  })

  it("matches case-insensitively", async () => {
    const { isPrivateViewerOwner } = await loadWithEnv("owner@example.com")
    expect(isPrivateViewerOwner("OWNER@Example.com")).toBe(true)
  })

  it("does not match a different email", async () => {
    const { isPrivateViewerOwner } = await loadWithEnv("owner@example.com")
    expect(isPrivateViewerOwner("someone-else@example.com")).toBe(false)
  })

  it("fails closed (returns false for every input) when the env var is unset", async () => {
    const { isPrivateViewerOwner } = await loadWithEnv(undefined)
    expect(isPrivateViewerOwner("owner@example.com")).toBe(false)
    expect(isPrivateViewerOwner(null)).toBe(false)
    expect(isPrivateViewerOwner(undefined)).toBe(false)
  })

  it("returns false for null/undefined input without throwing when env is set", async () => {
    const { isPrivateViewerOwner } = await loadWithEnv("owner@example.com")
    expect(isPrivateViewerOwner(null)).toBe(false)
    expect(isPrivateViewerOwner(undefined)).toBe(false)
  })
})
