import { hash } from "bcryptjs"
import { test, expect } from "./helpers/fixtures"
import { PRIVATE_VIEWER_EMAIL } from "@/lib/private-access"
import { excludeTestShows } from "@/lib/test-filters"

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
    // playwright.config.ts points PRIVATE_VIEWER_EMAIL at a disposable test
    // fixture address for all test runs, so it's always safe to create.
    await prisma.user.deleteMany({ where: { email: PRIVATE_VIEWER_EMAIL } })

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

test.describe("Submission timestamp formatting", () => {
  test.use({ timezoneId: "America/Los_Angeles" })

  test("should render the submission time in the viewer's browser timezone", async ({
    page,
    prisma,
  }) => {
    // playwright.config.ts points PRIVATE_VIEWER_EMAIL at a disposable test
    // fixture address for all test runs, so it's always safe to create.
    await prisma.user.deleteMany({ where: { email: PRIVATE_VIEWER_EMAIL } })

    const password = "OwnerTestPassword123!"
    const ownerUsername = `owner${Date.now()}`
    await prisma.user.create({
      data: {
        email: PRIVATE_VIEWER_EMAIL,
        username: ownerUsername,
        passwordHash: await hash(password, 12),
        emailVerified: new Date(),
      },
    })

    // The submissions page always picks the earliest incomplete show with no
    // date bound of its own, and CI runs against a persistent, shared test
    // database — so a leftover incomplete show from an unrelated past run
    // could otherwise outrank a hardcoded future date. Undercut whatever
    // currently exists to guarantee this show is the one the page picks.
    const earliestExisting = await prisma.show.findFirst({
      where: { isComplete: false, ...excludeTestShows },
      orderBy: { showDate: "asc" },
    })
    const testDate = earliestExisting
      ? new Date(earliestExisting.showDate.getTime() - 24 * 60 * 60 * 1000)
      : new Date("2000-01-01T00:00:00.000Z")
    const show = await prisma.show.create({
      data: {
        venue: "Timestamp Venue",
        city: "Anytown",
        state: "NY",
        showDate: testDate,
        isComplete: false,
      },
    })

    const owner = await prisma.user.findUniqueOrThrow({
      where: { email: PRIVATE_VIEWER_EMAIL },
    })
    // 18:30 UTC on Jan 1 is 10:30 AM in America/Los_Angeles (PST, UTC-8;
    // no DST ambiguity in January).
    const submission = await prisma.submission.create({
      data: {
        userId: owner.id,
        showId: show.id,
        createdAt: new Date("2026-01-01T18:30:00.000Z"),
      },
    })

    try {
      await page.goto("/login")
      await page.getByPlaceholder("Email address").fill(PRIVATE_VIEWER_EMAIL)
      await page.getByPlaceholder("Password").fill(password)
      await page.click('button[type="submit"]')
      await expect(page).toHaveURL(/\/picks/, { timeout: 10000 })

      await page.goto("/submissions")

      const timestamp = page
        .getByText(ownerUsername, { exact: true })
        .locator("xpath=following-sibling::*[1]")
      await expect(timestamp).toHaveText("Jan 1, 10:30 AM")
    } finally {
      await prisma.submission.delete({ where: { id: submission.id } })
      await prisma.show.delete({ where: { id: show.id } })
      await prisma.user.delete({ where: { email: PRIVATE_VIEWER_EMAIL } })
    }
  })
})
