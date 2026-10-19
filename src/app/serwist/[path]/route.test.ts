import { describe, it, expect, vi } from "vitest"

const calls = vi.hoisted(() => [] as unknown[])
vi.mock("@serwist/turbopack", () => ({
  createSerwistRoute: (options: unknown) => {
    calls.push(options)
    return {
      dynamic: "force-static",
      dynamicParams: false,
      revalidate: false,
      generateStaticParams: () => [],
      GET: () => new Response("sw"),
    }
  },
}))

import * as route from "./route"

describe("/serwist/[path]", () => {
  it("builds the service worker route from src/app/sw.ts", () => {
    expect(calls).toEqual([{ swSrc: "src/app/sw.ts", useNativeEsbuild: true }])
    expect(route.GET).toBeTypeOf("function")
    expect(route.dynamic).toBe("force-static")
  })
})
