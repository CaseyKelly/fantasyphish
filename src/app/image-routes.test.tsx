import { describe, it, expect, vi } from "vitest"

const ImageResponse = vi.hoisted(() =>
  vi.fn(function (
    this: Record<string, unknown>,
    element: unknown,
    options: unknown
  ) {
    this.element = element
    this.options = options
  })
)
vi.mock("next/og", () => ({ ImageResponse }))

import OpenGraphImage, {
  alt,
  size as ogSize,
  contentType as ogType,
  runtime,
} from "./opengraph-image"
import Icon, { size as iconSize, contentType as iconType } from "./icon"

describe("generated images", () => {
  it("builds the Open Graph card", async () => {
    const res = (await OpenGraphImage()) as unknown as { options: unknown }
    expect(res.options).toEqual({ width: 1200, height: 630 })
    expect(ogSize).toEqual({ width: 1200, height: 630 })
    expect(ogType).toBe("image/png")
    expect(alt).toContain("FantasyPhish")
    expect(runtime).toBe("edge")
  })

  it("builds the favicon", () => {
    const res = Icon() as unknown as { options: unknown }
    expect(res.options).toEqual({ width: 32, height: 32 })
    expect(iconSize).toEqual({ width: 32, height: 32 })
    expect(iconType).toBe("image/png")
  })
})
