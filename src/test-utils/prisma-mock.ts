import { vi, type Mock } from "vitest"

export type ModelMock = Record<string, Mock>

export type PrismaMock = Record<string, ModelMock> & {
  $transaction: Mock
  $queryRaw: Mock
  $executeRaw: Mock
}

/**
 * Builds a stand-in for the Prisma client where every `prisma.<model>.<method>`
 * is lazily created as a `vi.fn()` the first time a test touches it. Unset
 * methods resolve to `undefined`, so a test only stubs the calls it cares
 * about. `$transaction` runs the callback form against the same mock and
 * awaits the array form, matching how the app uses both.
 *
 * Usage (vi.mock is hoisted, so build the mock inside the factory):
 *
 *   vi.mock("@/lib/prisma", async () => {
 *     const { createPrismaMock } = await import("@/test-utils/prisma-mock")
 *     const prisma = createPrismaMock()
 *     return { prisma, default: prisma }
 *   })
 *   import { prisma } from "@/lib/prisma"
 *   const db = prisma as unknown as PrismaMock
 *
 * Call `resetPrismaMock(db)` in beforeEach so stubs don't leak across tests.
 */
export function createPrismaMock(): PrismaMock {
  const models = new Map<string, ModelMock>()
  const roots = new Map<string, Mock>()

  const makeModel = (): ModelMock =>
    new Proxy({} as ModelMock, {
      get(target, prop) {
        if (typeof prop !== "string") return undefined
        if (!(prop in target)) target[prop] = vi.fn()
        return target[prop]
      },
    })

  const mock: PrismaMock = new Proxy({} as PrismaMock, {
    get(_target, prop) {
      if (typeof prop !== "string" || prop === "then") return undefined
      if (prop === "__reset") {
        return () => {
          models.clear()
          roots.clear()
        }
      }
      if (prop.startsWith("$")) {
        if (!roots.has(prop)) {
          const fn =
            prop === "$transaction"
              ? vi.fn(async (arg: unknown) =>
                  typeof arg === "function"
                    ? (arg as (tx: PrismaMock) => unknown)(mock)
                    : Promise.all(arg as Promise<unknown>[])
                )
              : vi.fn()
          roots.set(prop, fn)
        }
        return roots.get(prop)
      }
      if (!models.has(prop)) models.set(prop, makeModel())
      return models.get(prop)
    },
  })

  return mock
}

export function resetPrismaMock(mock: PrismaMock): void {
  ;(mock as unknown as { __reset: () => void }).__reset()
}
