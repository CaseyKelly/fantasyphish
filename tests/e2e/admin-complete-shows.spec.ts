import { test, expect } from "./helpers/fixtures"

test.describe.configure({ mode: "serial" })

test.describe("Admin complete-shows", () => {
  test("should redirect unauthenticated visitors to login", async ({
    page,
  }) => {
    await page.goto("/admin/complete-shows")
    await expect(page).toHaveURL(/\/login/, { timeout: 10000 })

    const response = await page.request.post("/api/admin/complete-show", {
      data: { showId: "anything" },
    })
    expect(response.status()).toBe(401)
  })

  test("should 404 for a logged-in non-admin user", async ({
    page,
    createUser,
  }) => {
    const userEmail = `user-admin-complete-shows-${Date.now()}@example.com`
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

    await expect(page.getByRole("link", { name: "Admin" })).toHaveCount(0)

    const pageResponse = await page.request.get("/admin/complete-shows")
    expect(pageResponse.status()).toBe(404)

    const apiResponse = await page.request.post("/api/admin/complete-show", {
      data: { showId: "anything" },
    })
    expect(apiResponse.status()).toBe(401)
  })

  test("should let an admin list and act on in-progress shows", async ({
    page,
    createAdmin,
    prisma,
  }) => {
    const adminEmail = `admin-complete-shows-${Date.now()}@example.com`
    const adminUsername = `admin${Date.now()}`
    const adminPassword = "AdminPassword123!"

    await createAdmin({
      email: adminEmail,
      username: adminUsername,
      password: adminPassword,
      verified: true,
    })

    const showDate = new Date()
    showDate.setFullYear(2030)
    showDate.setMonth(4)
    showDate.setMilliseconds(Date.now() % 1000)

    const show = await prisma.show.create({
      data: {
        venue: "Test Venue Complete Shows",
        city: null,
        state: null,
        showDate,
        // In the past relative to real time so the complete-shows query
        // (which only lists locked shows) picks this show up, while the
        // showDate itself stays in the future so phish.net has no real
        // setlist data for it.
        lockTime: new Date(Date.now() - 60 * 60 * 1000),
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
      await page.getByRole("link", { name: "Complete Shows" }).click()
      await expect(page).toHaveURL(/\/admin\/complete-shows/, {
        timeout: 10000,
      })
      await expect(
        page.getByRole("heading", { name: "In-Progress Shows" })
      ).toBeVisible()

      // A show with no city/state shouldn't render a dangling "•" separator
      const row = page.getByText("Test Venue Complete Shows", { exact: false })
      await expect(row).toBeVisible()
      await expect(page.getByText("Test Venue Complete Shows •")).toHaveCount(0)

      // Direct API validation, using the admin session from the browser context
      const missingBody = await page.request.post("/api/admin/complete-show", {
        data: {},
      })
      expect(missingBody.status()).toBe(400)

      const unknownShow = await page.request.post("/api/admin/complete-show", {
        data: { showId: "does-not-exist" },
      })
      expect(unknownShow.status()).toBe(404)

      // The synthetic show's date has no real setlist data available, so
      // completing it surfaces the "no setlist" error path end-to-end
      // rather than fabricating a fake successful score.
      const noSetlist = await page.request.post("/api/admin/complete-show", {
        data: { showId: show.id },
      })
      expect(noSetlist.status()).toBe(400)
      expect((await noSetlist.json()).error).toMatch(/setlist/i)
    } finally {
      await prisma.show.delete({ where: { id: show.id } })
    }
  })
})
