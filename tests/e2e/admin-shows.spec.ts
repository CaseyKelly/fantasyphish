import { test, expect } from "./helpers/fixtures"
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
    const userUsername = `user${Date.now()}`
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

    await expect(page.getByRole("link", { name: "Lock Times" })).toHaveCount(0)

    const response = await page.request.get("/admin/shows")
    expect(response.status()).toBe(404)
  })

  test("should let an admin set and clear a show lock time override", async ({
    page,
    createAdmin,
    prisma,
  }) => {
    const adminEmail = `admin-shows-${Date.now()}@example.com`
    const adminUsername = `admin${Date.now()}`
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

    await page.goto("/login")
    await page.getByPlaceholder("Email address").fill(adminEmail)
    await page.getByPlaceholder("Password").fill(adminPassword)
    await page.click('button[type="submit"]')
    await expect(page).toHaveURL(/\/picks/, { timeout: 10000 })

    await page.getByRole("link", { name: "Lock Times" }).first().click()
    await expect(page).toHaveURL(/\/admin\/shows/, { timeout: 10000 })
    await expect(
      page.getByRole("heading", { name: "Show Lock Times" })
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

    // Cleanup
    await prisma.show.delete({ where: { id: show.id } })
  })
})
