import { describe, it, expect, vi } from "vitest"
import { withRetry } from "./db-retry"

describe("withRetry", () => {
  it("returns the result on first success without retrying", async () => {
    const operation = vi.fn().mockResolvedValue("ok")
    const result = await withRetry(operation, { delayMs: 1 })
    expect(result).toBe("ok")
    expect(operation).toHaveBeenCalledTimes(1)
  })

  it.each(["ECONNREFUSED", "P1001"])(
    "retries on a connection error (%s) and succeeds on a later attempt",
    async (errorSubstring) => {
      const operation = vi
        .fn()
        .mockRejectedValueOnce(new Error(`boom: ${errorSubstring}`))
        .mockResolvedValueOnce("recovered")

      const result = await withRetry(operation, { delayMs: 1, maxRetries: 3 })

      expect(result).toBe("recovered")
      expect(operation).toHaveBeenCalledTimes(2)
    }
  )

  it("exhausts maxRetries on a persistent connection error and rethrows", async () => {
    const error = new Error("Can't reach database server")
    const operation = vi.fn().mockRejectedValue(error)

    await expect(
      withRetry(operation, { delayMs: 1, maxRetries: 3 })
    ).rejects.toThrow(error)
    expect(operation).toHaveBeenCalledTimes(3)
  })

  it("rethrows immediately on a non-connection error without retrying", async () => {
    const error = new Error("some unrelated application error")
    const operation = vi.fn().mockRejectedValue(error)

    await expect(
      withRetry(operation, { delayMs: 1, maxRetries: 3 })
    ).rejects.toThrow(error)
    expect(operation).toHaveBeenCalledTimes(1)
  })
})
