import crypto from "crypto"
import { test, expect } from "./helpers/fixtures"

test.describe.configure({ mode: "serial" })

// uniqueUsername() from the shared fixtures produces names around 27
// characters, well past the app's 20-char username limit - fine for the
// other suites, which only ever pass it straight to direct DB creation, but
// here we also type usernames into the edit form, where the input's
// maxLength (and the server's Zod validation) would silently truncate
// anything longer, breaking the assertions below. Keep this local rather
// than shortening the shared helper, since callers elsewhere rely on its
// current collision-safety margin.
function shortUniqueUsername(prefix: string): string {
  return `${prefix}${Date.now().toString(36)}${crypto.randomBytes(2).toString("hex")}`
}

test.describe("Username editing", () => {
  test("should let a user change their username to an available one", async ({
    page,
    createUser,
    prisma,
  }) => {
    const userEmail = `user-username-edit-${Date.now()}@example.com`
    const userUsername = shortUniqueUsername("editme")
    const newUsername = shortUniqueUsername("editedto")
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

    await page.goto("/profile")
    await expect(page).toHaveURL(new RegExp(`/user/${userUsername}$`), {
      timeout: 10000,
    })

    await page.getByRole("button", { name: "Edit username" }).click()
    const input = page.getByRole("textbox", { name: "Username" })
    await input.fill(newUsername)
    await page.getByRole("button", { name: "Save username" }).click()

    // Redirected to the profile at its new URL
    await expect(page).toHaveURL(new RegExp(`/user/${newUsername}$`), {
      timeout: 10000,
    })
    await expect(page.getByRole("heading", { name: newUsername })).toBeVisible()

    const updatedUser = await prisma.user.findUnique({
      where: { email: userEmail.toLowerCase() },
      select: { username: true },
    })
    expect(updatedUser?.username).toBe(newUsername)

    // Session cookie was refreshed, not just client-side state - a hard
    // reload of the new profile URL still resolves "own profile" from the
    // session, so the edit control is still there.
    await page.reload()
    await expect(
      page.getByRole("button", { name: "Edit username" })
    ).toBeVisible()
  })

  test("should reject a username that is already taken", async ({
    page,
    createUser,
  }) => {
    const takenUsername = shortUniqueUsername("taken")
    await createUser({
      email: `user-username-taken-${Date.now()}@example.com`,
      username: takenUsername,
      password: "OtherPassword123!",
      verified: true,
    })

    const userEmail = `user-username-conflict-${Date.now()}@example.com`
    const userUsername = shortUniqueUsername("conflict")
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

    await page.goto(`/user/${userUsername}`)

    await page.getByRole("button", { name: "Edit username" }).click()
    await page.getByRole("textbox", { name: "Username" }).fill(takenUsername)
    await page.getByRole("button", { name: "Save username" }).click()

    await expect(page.getByText(/already taken/i)).toBeVisible({
      timeout: 10000,
    })

    // Stays on the original profile - the username was not changed
    await expect(page).toHaveURL(new RegExp(`/user/${userUsername}$`))
  })
})
