import { test, expect } from "./helpers/fixtures"
import {
  generateTestEmail,
  waitForEmail,
  extractVerificationToken,
} from "./helpers/email"

test.describe.configure({ mode: "serial" }) // Run tests sequentially to avoid rate limiting

// Regular CI/local runs skip the real Resend send (see src/lib/email.ts)
// to avoid burning the daily send quota; a separate scheduled workflow
// runs with SKIP_EMAIL_SEND unset to exercise the real Resend integration.
const skipEmailSend = process.env.SKIP_EMAIL_SEND === "true"

/**
 * Email sending strategy:
 * - Test 1 (full registration flow): Sends a real email via Resend to test the
 *   end-to-end flow, unless SKIP_EMAIL_SEND is set, in which case it reads the
 *   verification token straight from the database instead.
 * - All other tests: Use direct database creation to avoid hitting email quota
 */
test.describe("User Authentication", () => {
  test("should complete full registration flow with email verification", async ({
    page,
    prisma,
    cleanupEmail,
  }) => {
    const testEmail = generateTestEmail("register-flow")
    const testUsername = `testuser${Date.now()}`
    const testPassword = "TestPassword123!"

    await cleanupEmail(testEmail)

    // Navigate to registration page and fill out form
    await page.goto("/register")
    await expect(page).toHaveTitle(/FantasyPhish/)

    await page.getByPlaceholder("Username").fill(testUsername)
    await page.getByPlaceholder("Email address").fill(testEmail)
    await page
      .getByPlaceholder("Password (min 8 characters)")
      .fill(testPassword)
    await page.getByPlaceholder("Confirm password").fill(testPassword)
    await page.click('button[type="submit"]')

    // Verify success message
    await expect(page.getByText(/check your email/i)).toBeVisible({
      timeout: 10000,
    })

    let verificationToken: string | null

    if (skipEmailSend) {
      // No real email was sent - read the token the registration route
      // already persisted to the database.
      await expect
        .poll(
          async () => {
            const user = await prisma.user.findUnique({
              where: { email: testEmail.toLowerCase() },
              select: { verificationToken: true },
            })
            return user?.verificationToken ?? null
          },
          { timeout: 10000 }
        )
        .toBeTruthy()

      const user = await prisma.user.findUnique({
        where: { email: testEmail.toLowerCase() },
        select: { verificationToken: true },
      })
      verificationToken = user?.verificationToken ?? null
    } else {
      // Wait for the real verification email and extract the token
      const email = await waitForEmail(testEmail, {
        subject: "Verify your FantasyPhish account",
        timeout: 30000,
      })

      // Verify email content
      expect(email.html).toContain("Verify your email address")
      expect(email.html).toContain("FantasyPhish")
      expect(email.from).toContain("FantasyPhish")

      verificationToken = extractVerificationToken(email.html)
    }

    expect(verificationToken).toBeTruthy()
    expect(verificationToken).toHaveLength(64)

    // Visit verification URL
    await page.goto(`/verify?token=${verificationToken}`)
    await expect(page.getByText(/email verified/i)).toBeVisible({
      timeout: 10000,
    })

    // Should be redirected to login page after verification
    await expect(page).toHaveURL(/\/login/, { timeout: 10000 })

    // Login with the verified credentials
    await page.getByPlaceholder("Email address").fill(testEmail)
    await page.getByPlaceholder("Password").fill(testPassword)
    await page.click('button[type="submit"]')

    // Should reach picks page after login (successful authentication)
    await expect(page).toHaveURL(/\/picks/, { timeout: 10000 })
  })

  test("should login with verified credentials", async ({
    page,
    createUser,
  }) => {
    const testEmail = `test-login-${Date.now()}@example.com`
    const testUsername = `loginuser${Date.now()}`
    const testPassword = "TestPassword123!"

    // Create user directly in database (no email sent)
    await createUser({
      email: testEmail,
      username: testUsername,
      password: testPassword,
      verified: true,
    })

    // Login with credentials
    await page.goto("/login")
    await page.getByPlaceholder("Email address").fill(testEmail)
    await page.getByPlaceholder("Password").fill(testPassword)
    await page.click('button[type="submit"]')
    await expect(page).toHaveURL(/\/picks/, { timeout: 10000 })

    // Logout
    const logoutButton = page.getByRole("button", { name: /logout|sign out/i })
    if (await logoutButton.isVisible()) {
      await logoutButton.click()
      // Wait for logout to complete and redirect to home page
      await page.waitForURL(/\/$/, { timeout: 10000 })
    } else {
      await page.goto("/login")
    }

    // Verify login works again after logout using the same credentials
    await page.goto("/login")
    await page.getByPlaceholder("Email address").fill(testEmail)
    await page.getByPlaceholder("Password").fill(testPassword)
    await page.click('button[type="submit"]')

    // Should be redirected to picks page
    await expect(page).toHaveURL(/\/picks/, { timeout: 10000 })
  })

  test("should not allow login with unverified email", async ({
    page,
    createUser,
  }) => {
    const testEmail = `test-unverified-${Date.now()}@example.com`
    const testUsername = `unverified${Date.now()}`
    const testPassword = "TestPassword123!"

    // Create user directly in database as unverified (no email sent)
    await createUser({
      email: testEmail,
      username: testUsername,
      password: testPassword,
      verified: false,
    })

    // Try to login without verifying email
    await page.goto("/login")
    await page.getByPlaceholder("Email address").fill(testEmail)
    await page.getByPlaceholder("Password").fill(testPassword)
    await page.click('button[type="submit"]')

    // Should redirect to verification required page
    await expect(page).toHaveURL(/\/verify-required/, { timeout: 5000 })
    await expect(
      page.getByRole("heading", { name: /please verify your email/i })
    ).toBeVisible()
    await expect(
      page.getByText(/a verification email has been sent to/i)
    ).toBeVisible()
    await expect(
      page.getByRole("button", { name: /resend verification email/i })
    ).toBeVisible()
  })

  test("should reject invalid verification token", async ({ page }) => {
    const fakeToken = "a".repeat(64)

    await page.goto(`/verify?token=${fakeToken}`)

    // Should show error message
    await expect(page.getByText(/invalid.*token/i)).toBeVisible({
      timeout: 10000,
    })
  })

  test.skip("should successfully logout user", async ({ page, createUser }) => {
    const testEmail = `test-logout-${Date.now()}@example.com`
    const testUsername = `logoutuser${Date.now()}`
    const testPassword = "TestPassword123!"

    // Create user directly in database (no email sent)
    await createUser({
      email: testEmail,
      username: testUsername,
      password: testPassword,
      verified: true,
    })

    // Login
    await page.goto("/login")
    await page.getByPlaceholder("Email address").fill(testEmail)
    await page.getByPlaceholder("Password").fill(testPassword)
    await page.click('button[type="submit"]')

    // Wait for navigation to picks page
    await expect(page).toHaveURL(/\/picks/, { timeout: 10000 })

    // Wait for the navbar to fully load with session data
    // The Sign Out button only appears when session is loaded
    await expect(page.getByRole("button", { name: /sign out/i })).toBeVisible({
      timeout: 10000,
    })

    // Click Sign Out button
    await page.getByRole("button", { name: /sign out/i }).click()

    // Should be redirected to home page
    await expect(page).toHaveURL(/\/$/, { timeout: 10000 })

    // Should see login/signup buttons (not logged in anymore)
    await expect(page.getByRole("link", { name: /log in/i })).toBeVisible()
    await expect(page.getByRole("link", { name: /sign up/i })).toBeVisible()

    // Try to access protected page - should redirect to login
    await page.goto("/picks")
    await expect(page).toHaveURL(/\/login/, { timeout: 10000 })
  })
})
