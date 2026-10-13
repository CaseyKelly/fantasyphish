import { describe, it, expect } from "vitest"
import {
  toDirectNeonUrl,
  resolveMigrationTarget,
  describeMigrationTarget,
} from "./migration-url"

const PROD_DIRECT =
  "postgresql://u:p@ep-prod-123.c-3.us-east-1.aws.neon.tech/neondb?sslmode=require"
const PROD_POOLED =
  "postgresql://u:p@ep-prod-123-pooler.c-3.us-east-1.aws.neon.tech/neondb?sslmode=require"
const PREVIEW_POOLED =
  "postgresql://u:p@ep-preview-456-pooler.c-3.us-east-1.aws.neon.tech/neondb?sslmode=require"

describe("toDirectNeonUrl", () => {
  it("strips -pooler from a Neon pooled host", () => {
    expect(toDirectNeonUrl(PROD_POOLED)).toBe(PROD_DIRECT)
  })

  it("leaves direct and non-Neon URLs alone", () => {
    expect(toDirectNeonUrl(PROD_DIRECT)).toBe(PROD_DIRECT)
    const local = "postgresql://localhost:5432/fantasyphish"
    expect(toDirectNeonUrl(local)).toBe(local)
    expect(toDirectNeonUrl("not a url")).toBe("not a url")
  })
})

describe("resolveMigrationTarget", () => {
  it("prefers DIRECT_URL off Vercel (local dev, CI)", () => {
    expect(
      resolveMigrationTarget({ DIRECT_URL: PROD_DIRECT, DATABASE_URL: "x" })
    ).toEqual({ url: PROD_DIRECT })
    expect(resolveMigrationTarget({ DATABASE_URL: PROD_POOLED })).toEqual({
      url: PROD_POOLED,
    })
  })

  it("migrates the preview branch's own database on preview deploys", () => {
    const target = resolveMigrationTarget({
      VERCEL: "1",
      VERCEL_ENV: "preview",
      DIRECT_URL: PROD_DIRECT,
      DATABASE_URL: PREVIEW_POOLED,
    })
    expect(target.skipReason).toBeUndefined()
    expect(describeMigrationTarget(target)).toBe(
      "ep-preview-456.c-3.us-east-1.aws.neon.tech"
    )
  })

  it("skips a preview deploy whose DATABASE_URL is production", () => {
    const target = resolveMigrationTarget({
      VERCEL: "1",
      VERCEL_ENV: "preview",
      DIRECT_URL: PROD_DIRECT,
      DATABASE_URL: PROD_POOLED,
    })
    expect(target.skipReason).toMatch(/production database/)
  })

  it("skips a preview deploy with no DATABASE_URL", () => {
    const target = resolveMigrationTarget({
      VERCEL: "1",
      VERCEL_ENV: "preview",
      DIRECT_URL: PROD_DIRECT,
    })
    expect(target.skipReason).toMatch(/not set/)
  })

  it("migrates production via its own DATABASE_URL on production deploys", () => {
    expect(
      resolveMigrationTarget({
        VERCEL: "1",
        VERCEL_ENV: "production",
        DIRECT_URL: PROD_DIRECT,
        DATABASE_URL: PROD_POOLED,
      })
    ).toEqual({ url: PROD_DIRECT })
  })
})
