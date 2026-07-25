import { hash } from "bcryptjs"
import { test, expect } from "./helpers/fixtures"
import { PRIVATE_VIEWER_EMAIL } from "@/lib/private-access"

test.describe.configure({ mode: "serial" })

test.describe("Private submissions viewer", () => {
  test("should redirect unauthenticated visitors to login", async ({
    page,
  }) => {
    const response = await page.goto("/submissions")
    await expect(page).toHaveURL(/\/login/, { timeout: 10000 })
    expect(response?.status()).toBe(200) // login page itself renders fine
  })

  test("should 404 for a logged-in non-owner user", async ({
    page,
    createUser,
  }) => {
    const userEmail = `user-submissions-${Date.now()}@example.com`
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

    await expect(page.getByRole("link", { name: "Submissions" })).toHaveCount(0)

    const response = await page.request.get("/submissions")
    expect(response.status()).toBe(404)
  })

  test("should 404 for a logged-in admin who isn't the designated owner", async ({
    page,
    createAdmin,
  }) => {
    const adminEmail = `admin-submissions-${Date.now()}@example.com`
    const adminUsername = `admin${Date.now()}`
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

    // Visibility is gated by email, not isAdmin, so an admin account
    // that isn't the designated owner must still be denied, and must
    // not see the nav link either.
    await expect(page.getByRole("link", { name: "Submissions" })).toHaveCount(0)

    const response = await page.request.get("/submissions")
    expect(response.status()).toBe(404)
  })

  test("should allow the designated owner account to view submissions", async ({
    page,
    prisma,
  }) => {
    const existingOwner = await prisma.user.findUnique({
      where: { email: PRIVATE_VIEWER_EMAIL },
    })
    test.skip(
      !!existingOwner,
      "Owner account already exists in this database; skipping rather than mutating it"
    )

    const password = "OwnerTestPassword123!"
    await prisma.user.create({
      data: {
        email: PRIVATE_VIEWER_EMAIL,
        username: `owner${Date.now()}`,
        passwordHash: await hash(password, 12),
        emailVerified: new Date(),
      },
    })

    try {
      await page.goto("/login")
      await page.getByPlaceholder("Email address").fill(PRIVATE_VIEWER_EMAIL)
      await page.getByPlaceholder("Password").fill(password)
      await page.click('button[type="submit"]')
      await expect(page).toHaveURL(/\/picks/, { timeout: 10000 })

      const response = await page.request.get("/submissions")
      expect(response.status()).toBe(200)

      // Only the owner should see the nav link, and it should lead here.
      await page.getByRole("link", { name: "Submissions" }).first().click()
      await expect(page).toHaveURL(/\/submissions/, { timeout: 10000 })
      await expect(
        page.getByRole("heading", { name: "Submissions" })
      ).toBeVisible()
    } finally {
      await prisma.user.delete({ where: { email: PRIVATE_VIEWER_EMAIL } })
    }
  })
})
