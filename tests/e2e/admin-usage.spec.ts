import { test, expect, uniqueUsername } from "./helpers/fixtures"

test.describe.configure({ mode: "serial" })

test.describe("Admin usage dashboard", () => {
  test("should redirect unauthenticated visitors to login", async ({
    page,
  }) => {
    const response = await page.goto("/admin/usage")
    await expect(page).toHaveURL(/\/login/, { timeout: 10000 })
    expect(response?.status()).toBe(200) // login page itself renders fine
  })

  test("should 404 for a logged-in non-admin user", async ({
    page,
    createUser,
  }) => {
    const userEmail = `user-admin-usage-${Date.now()}@example.com`
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

    const response = await page.request.get("/admin/usage")
    expect(response.status()).toBe(404)
  })

  test("should allow a logged-in admin to view the dashboard", async ({
    page,
    createAdmin,
  }) => {
    const adminEmail = `admin-usage-${Date.now()}@example.com`
    const adminUsername = uniqueUsername("admin")
    const adminPassword = "AdminPassword123!"

    await createAdmin({
      email: adminEmail,
      username: adminUsername,
      password: adminPassword,
      verified: true,
    })

    await page.goto("/login")
    await page.getByPlaceholder("Email address").fill(adminEmail)
    await page.getByPlaceholder("Password").fill(adminPassword)
    await page.click('button[type="submit"]')
    await expect(page).toHaveURL(/\/picks/, { timeout: 10000 })

    const response = await page.request.get("/admin/usage")
    expect(response.status()).toBe(200)

    await page.getByRole("link", { name: "Admin" }).first().click()
    await expect(page).toHaveURL(/\/admin$/, { timeout: 10000 })
    await page.getByRole("link", { name: "Feature Usage" }).click()
    await expect(page).toHaveURL(/\/admin\/usage/, { timeout: 10000 })
    await expect(
      page.getByRole("heading", { name: "Feature Usage" })
    ).toBeVisible()
  })
})
