import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { readFileSync } from "fs"
import path from "path"
import { NextResponse } from "next/server"

vi.mock("@sentry/nextjs", async () => {
  const { createSentryMock } = await import("@/test-utils/sentry-mock")
  return createSentryMock()
})

import * as Sentry from "@sentry/nextjs"
import { resetSentryMock, type SentryMock } from "@/test-utils/sentry-mock"
import { makeRequest } from "@/test-utils/request"
import { CRON_MONITORS, runMonitoredCron } from "./cron-monitor"

const sentry = Sentry as unknown as SentryMock
const monitor = CRON_MONITORS.score

const req = (authorization = "Bearer secret") =>
  makeRequest("/api/score", { headers: { authorization } })

beforeEach(() => {
  resetSentryMock(sentry)
  vi.stubEnv("CRON_SECRET", "secret")
  vi.stubEnv("VERCEL_ENV", "production")
  vi.spyOn(console, "error").mockImplementation(() => {})
})

afterEach(() => {
  vi.unstubAllEnvs()
  vi.restoreAllMocks()
})

describe("runMonitoredCron", () => {
  it("checks in ok with the monitor's config and flushes", async () => {
    const res = await runMonitoredCron(req(), "[Test]", monitor, async () =>
      NextResponse.json({ success: true })
    )
    expect(res.status).toBe(200)
    expect(sentry.withMonitor).toHaveBeenCalledWith(
      "fantasyphish-score",
      expect.any(Function),
      monitor.config
    )
    expect(sentry.checkIns).toEqual([
      { slug: "fantasyphish-score", status: "ok" },
    ])
    expect(sentry.flush).toHaveBeenCalled()
  })

  it("counts an idle early return as a healthy run", async () => {
    const res = await runMonitoredCron(req(), "[Test]", monitor, async () =>
      NextResponse.json({ skipped: true, reason: "No active tours" })
    )
    expect(res.status).toBe(200)
    expect(sentry.checkIns).toEqual([
      { slug: "fantasyphish-score", status: "ok" },
    ])
  })

  it("marks the check-in failed when the job returns an error response", async () => {
    const res = await runMonitoredCron(req(), "[Test]", monitor, async () =>
      NextResponse.json({ error: "boom" }, { status: 500 })
    )
    expect(res.status).toBe(500)
    expect(await res.json()).toEqual({ error: "boom" })
    expect(sentry.checkIns).toEqual([
      { slug: "fantasyphish-score", status: "error" },
    ])
    expect(sentry.flush).toHaveBeenCalled()
  })

  it("marks the check-in failed and rethrows when the job throws", async () => {
    await expect(
      runMonitoredCron(req(), "[Test]", monitor, async () => {
        throw new Error("unexpected")
      })
    ).rejects.toThrow("unexpected")
    expect(sentry.checkIns).toEqual([
      { slug: "fantasyphish-score", status: "error" },
    ])
    expect(sentry.flush).toHaveBeenCalled()
  })

  it.each(["preview", ""])(
    "runs the job without a check-in when VERCEL_ENV is %j",
    async (vercelEnv) => {
      vi.stubEnv("VERCEL_ENV", vercelEnv)
      const res = await runMonitoredCron(req(), "[Test]", monitor, async () =>
        NextResponse.json({ error: "boom" }, { status: 500 })
      )
      expect(res.status).toBe(500)
      expect(sentry.withMonitor).not.toHaveBeenCalled()
      expect(sentry.checkIns).toEqual([])
    }
  )

  it.each([
    ["a bad secret", "secret", "Bearer nope", 401],
    ["an unset CRON_SECRET", "", "Bearer secret", 500],
  ])(
    "rejects %s without running the job or checking in",
    async (_label, secret, authorization, status) => {
      vi.stubEnv("CRON_SECRET", secret)
      const job = vi.fn()
      const res = await runMonitoredCron(
        req(authorization),
        "[Test]",
        monitor,
        job
      )
      expect(res.status).toBe(status)
      expect(job).not.toHaveBeenCalled()
      expect(sentry.withMonitor).not.toHaveBeenCalled()
      expect(sentry.checkIns).toEqual([])
    }
  )
})

describe("CRON_MONITORS", () => {
  const monitorPaths: Record<keyof typeof CRON_MONITORS, string> = {
    score: "/api/score",
    syncTours: "/api/sync-tours",
    syncSongStats: "/api/sync-song-stats",
    awardAchievements: "/api/award-achievements",
    sendReminders: "/api/send-reminders",
  }
  const vercel = JSON.parse(
    readFileSync(path.resolve(__dirname, "../../vercel.json"), "utf8")
  ) as { crons: { path: string; schedule: string }[] }

  it("monitors every cron in vercel.json", () => {
    expect(new Set(vercel.crons.map((cron) => cron.path))).toEqual(
      new Set(Object.values(monitorPaths))
    )
  })

  it.each(Object.entries(monitorPaths))(
    "%s matches its vercel.json schedule",
    (key, cronPath) => {
      const { config } = CRON_MONITORS[key as keyof typeof CRON_MONITORS]
      // A path scheduled more than once (send-reminders) is one monitor
      // whose hour field lists every scheduled hour
      const schedules = vercel.crons
        .filter((cron) => cron.path === cronPath)
        .map((cron) => cron.schedule.split(" "))
      const expected =
        schedules.length === 1
          ? schedules[0].join(" ")
          : [
              schedules[0][0],
              schedules.map((fields) => fields[1]).join(","),
              ...schedules[0].slice(2),
            ].join(" ")
      expect(config.schedule).toEqual({ type: "crontab", value: expected })
      expect(config.timezone).toBe("UTC")
    }
  )

  it("uses a unique slug per monitor", () => {
    const slugs = Object.values(CRON_MONITORS).map((m) => m.slug)
    expect(new Set(slugs).size).toBe(slugs.length)
  })
})
