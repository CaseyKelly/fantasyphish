import { test, expect, uniqueUsername } from "./helpers/fixtures"

test.describe.configure({ mode: "serial" })

test.describe("Username editing", () => {
  test("should let a user change their username to an available one", async ({
    page,
    createUser,
    prisma,
  }) => {
    const userEmail = `user-username-edit-${Date.now()}@example.com`
    const userUsername = uniqueUsername("editme")
    const newUsername = uniqueUsername("editedto")
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

    // Session cookie was refreshed, not just the visible page - the old
    // username is no longer treated as "own profile" on a hard reload.
    await page.goto(`/user/${userUsername}`)
    await expect(
      page.getByRole("button", { name: "Edit username" })
    ).toHaveCount(0)
  })

  test("should reject a username that is already taken", async ({
    page,
    createUser,
  }) => {
    const takenUsername = uniqueUsername("taken")
    await createUser({
      email: `user-username-taken-${Date.now()}@example.com`,
      username: takenUsername,
      password: "OtherPassword123!",
      verified: true,
    })

    const userEmail = `user-username-conflict-${Date.now()}@example.com`
    const userUsername = uniqueUsername("conflict")
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
