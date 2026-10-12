import { test, expect, uniqueUsername } from "./helpers/fixtures"
import { getShowLockTime } from "@/lib/timezone"

test.describe.configure({ mode: "serial" })

test.describe("Admin show lock time overrides", () => {
  test("should redirect unauthenticated visitors to login", async ({
    page,
  }) => {
    await page.goto("/admin/shows")
    await expect(page).toHaveURL(/\/login/, { timeout: 10000 })
  })

  test("should 404 for a logged-in non-admin user", async ({
    page,
    createUser,
  }) => {
    const userEmail = `user-admin-shows-${Date.now()}@example.com`
    const userUsername = uniqueUsername("user")
    const userPassword = "UserPassword123!"

    await createUser({
      email: userEmail,
      username: userUsername,
      password: userPassword,
      verified: true,
    })

    await page.goto("/login")
    await page.getByPlaceholder("Email address").fill(userEmail)
    await page.getByPlaceholder("Password").fill(userPassword)
    await page.click('button[type="submit"]')
    await expect(page).toHaveURL(/\/picks/, { timeout: 10000 })

    await expect(page.getByRole("link", { name: "Admin" })).toHaveCount(0)

    const response = await page.request.get("/admin/shows")
    expect(response.status()).toBe(404)
  })

  test("should let an admin set and clear a show lock time override", async ({
    page,
    createAdmin,
    prisma,
  }) => {
    const adminEmail = `admin-shows-${Date.now()}@example.com`
    const adminUsername = uniqueUsername("admin")
    const adminPassword = "AdminPassword123!"

    await createAdmin({
      email: adminEmail,
      username: adminUsername,
      password: adminPassword,
      verified: true,
    })

    const testDate = new Date()
    testDate.setFullYear(2030)
    testDate.setMonth(4)
    testDate.setMilliseconds(Date.now() % 1000)

    const timezone = "America/New_York"
    const computedLockTime = getShowLockTime(testDate, timezone)

    // A decoy show in the same timezone, ordered before the real test show,
    // guards against a regression where the lock-time input's id collides
    // across same-timezone rows (each row's <label> must stay associated
    // with its own <input>, not just whichever is first on the page).
    const decoyDate = new Date(testDate.getTime() - 24 * 60 * 60 * 1000)
    const decoyShow = await prisma.show.create({
      data: {
        venue: "Test Venue Lock Override Decoy",
        city: "Test City",
        state: "NY",
        showDate: decoyDate,
        timezone,
        lockTime: getShowLockTime(decoyDate, timezone),
        isComplete: false,
      },
    })

    const show = await prisma.show.create({
      data: {
        venue: "Test Venue Lock Override",
        city: "Test City",
        state: "NY",
        showDate: testDate,
        timezone,
        lockTime: computedLockTime,
        isComplete: false,
      },
    })

    try {
      await page.goto("/login")
      await page.getByPlaceholder("Email address").fill(adminEmail)
      await page.getByPlaceholder("Password").fill(adminPassword)
      await page.click('button[type="submit"]')
      await expect(page).toHaveURL(/\/picks/, { timeout: 10000 })

      await page.getByRole("link", { name: "Admin" }).first().click()
      await expect(page).toHaveURL(/\/admin$/, { timeout: 10000 })
      await page.getByRole("link", { name: "Show Settings" }).click()
      await expect(page).toHaveURL(/\/admin\/shows/, { timeout: 10000 })
      await expect(
        page.getByRole("heading", { name: "Show Settings" })
      ).toBeVisible()

      const row = page.getByTestId(`show-lock-override-${show.id}`)
      await expect(row).toContainText("Test Venue Lock Override")

      // Set an override 30 minutes earlier than the standard 7 PM lock
      await row.getByLabel(/Lock time/).fill("18:30")
      await row.getByRole("button", { name: "Save" }).click()
      await expect(row).toContainText("manual override", { timeout: 10000 })

      const overridden = await prisma.show.findUnique({
        where: { id: show.id },
      })
      expect(overridden?.lockTimeOverride).not.toBeNull()
      expect(overridden?.lockTime?.toISOString()).toBe(
        overridden?.lockTimeOverride?.toISOString()
      )

      // Clear the override and confirm it reverts to the computed lock time
      await row.getByRole("button", { name: "Clear" }).click()
      await expect(row).not.toContainText("manual override", {
        timeout: 10000,
      })

      const cleared = await prisma.show.findUnique({ where: { id: show.id } })
      expect(cleared?.lockTimeOverride).toBeNull()
      expect(cleared?.lockTime?.toISOString()).toBe(
        computedLockTime.toISOString()
      )
    } finally {
      await prisma.show.delete({ where: { id: show.id } })
      await prisma.show.delete({ where: { id: decoyShow.id } })
    }
  })

  test("should let an admin change a show's set count until someone picks", async ({
    page,
    createAdmin,
    prisma,
  }) => {
    const adminUsername = uniqueUsername("adminsets")
    const adminEmail = `${adminUsername}@example.com`
    const adminPassword = "AdminPassword123!"

    await createAdmin({
      email: adminEmail,
      username: adminUsername,
      password: adminPassword,
      verified: true,
    })

    // 2031 keeps clear of the hardcoded 2030 dates in shows.spec.ts; the
    // millisecond jitter keeps this unique against parallel runs.
    const testDate = new Date()
    testDate.setFullYear(2031)
    testDate.setMonth(1)
    testDate.setMilliseconds(Date.now() % 1000)

    const show = await prisma.show.create({
      data: {
        venue: "Test Venue Set Count",
        city: "Test City",
        state: "NY",
        showDate: testDate,
        timezone: "America/New_York",
        isComplete: false,
      },
    })

    try {
      expect(show.setCount).toBe(2)

      await page.goto("/login")
      await page.getByPlaceholder("Email address").fill(adminEmail)
      await page.getByPlaceholder("Password").fill(adminPassword)
      await page.click('button[type="submit"]')
      await expect(page).toHaveURL(/\/picks/, { timeout: 10000 })

      await page.goto("/admin/shows")
      const row = page.getByTestId(`show-set-count-${show.id}`)
      await expect(row).toContainText("2 sets")

      await row.getByLabel("Sets").selectOption("3")
      await row.getByRole("button", { name: "Save sets" }).click()
      await expect(row).toContainText("3 sets", { timeout: 10000 })
      await expect(row).toContainText("9 regular")

      const updated = await prisma.show.findUnique({ where: { id: show.id } })
      expect(updated?.setCount).toBe(3)

      // Once anyone has submitted picks, the set count is frozen
      const admin = await prisma.user.findUnique({
        where: { email: adminEmail.toLowerCase() },
      })
      const songs = await prisma.song.findMany({ take: 1 })
      if (songs.length < 1) throw new Error("Not enough songs in database")
      await prisma.submission.create({
        data: {
          userId: admin!.id,
          showId: show.id,
          picks: {
            create: [{ songId: songs[0].id, pickType: "OPENER", openerSet: 1 }],
          },
        },
      })

      await page.reload()
      await expect(row).toContainText("Locked: 1 submission")
      await expect(row.getByLabel("Sets")).toHaveCount(0)

      const response = await page.request.post(
        "/api/admin/set-show-set-count",
        { data: { showId: show.id, setCount: 1 } }
      )
      expect(response.status()).toBe(409)

      const unchanged = await prisma.show.findUnique({
        where: { id: show.id },
      })
      expect(unchanged?.setCount).toBe(3)
    } finally {
      await prisma.show.delete({ where: { id: show.id } })
    }
  })
})
