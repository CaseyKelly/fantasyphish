import { test, expect } from "./helpers/fixtures"

test.describe.configure({ mode: "serial" })

test.describe("Admin Authorization", () => {
  test("should allow admin to delete submissions", async ({
    page,
    createAdmin,
    createUser,
    prisma,
  }) => {
    // Create admin user
    const adminEmail = `admin-delete-${Date.now()}@example.com`
    const adminUsername = `admin${Date.now()}`
    const adminPassword = "AdminPassword123!"

    await createAdmin({
      email: adminEmail,
      username: adminUsername,
      password: adminPassword,
      verified: true,
    })

    // Create regular user with a submission
    const userEmail = `user-${Date.now()}@example.com`
    const userUsername = `user${Date.now()}`
    const userPassword = "UserPassword123!"

    await createUser({
      email: userEmail,
      username: userUsername,
      password: userPassword,
      verified: true,
    })

    // Get the user from DB
    const user = await prisma.user.findUnique({
      where: { email: userEmail.toLowerCase() },
    })

    // Create a test show with unique date
    const testDate = new Date()
    testDate.setFullYear(2030)
    testDate.setMilliseconds(Date.now() % 1000) // Add uniqueness

    const show = await prisma.show.create({
      data: {
        venue: "Test Venue",
        city: "Test City",
        state: "NY",
        showDate: testDate,
        isComplete: false,
      },
    })

    // Get a song to use for picks
    const song = await prisma.song.findFirst()
    if (!song) throw new Error("No songs found in database")

    // Create submission for the user
    const submission = await prisma.submission.create({
      data: {
        userId: user!.id,
        showId: show.id,
        picks: {
          create: [
            { songId: song.id, pickType: "OPENER" },
            { songId: song.id, pickType: "ENCORE" },
          ],
        },
      },
    })

    // Login as admin
    await page.goto("/login")
    await page.getByPlaceholder("Email address").fill(adminEmail)
    await page.getByPlaceholder("Password").fill(adminPassword)
    await page.click('button[type="submit"]')
    await expect(page).toHaveURL(/\/picks/, { timeout: 10000 })

    // Try to delete the submission via API
    const response = await page.request.delete(
      `/api/admin/delete-submission/${submission.id}`
    )
    expect(response.status()).toBe(200)

    // Verify submission was deleted
    const deletedSubmission = await prisma.submission.findUnique({
      where: { id: submission.id },
    })
    expect(deletedSubmission).toBeNull()

    // Cleanup
    await prisma.show.delete({ where: { id: show.id } })
  })

  test("should prevent non-admin from deleting submissions", async ({
    page,
    createUser,
    prisma,
  }) => {
    // Create regular user
    const userEmail = `user-nonadmin-${Date.now()}@example.com`
    const userUsername = `user${Date.now()}`
    const userPassword = "UserPassword123!"

    await createUser({
      email: userEmail,
      username: userUsername,
      password: userPassword,
      verified: true,
    })

    // Get the user from DB
    const user = await prisma.user.findUnique({
      where: { email: userEmail.toLowerCase() },
    })

    // Create a test show with unique date
    const testDate = new Date()
    testDate.setFullYear(2030)
    testDate.setMonth(1) // Different month
    testDate.setMilliseconds(Date.now() % 1000)

    const show = await prisma.show.create({
      data: {
        venue: "Test Venue 2",
        city: "Test City",
        state: "NY",
        showDate: testDate,
        isComplete: false,
      },
    })

    // Get a song to use for picks
    const song = await prisma.song.findFirst()
    if (!song) throw new Error("No songs found in database")

    // Create submission for the user
    const submission = await prisma.submission.create({
      data: {
        userId: user!.id,
        showId: show.id,
        picks: {
          create: [
            { songId: song.id, pickType: "OPENER" },
            { songId: song.id, pickType: "ENCORE" },
          ],
        },
      },
    })

    // Login as regular user
    await page.goto("/login")
    await page.getByPlaceholder("Email address").fill(userEmail)
    await page.getByPlaceholder("Password").fill(userPassword)
    await page.click('button[type="submit"]')
    await expect(page).toHaveURL(/\/picks/, { timeout: 10000 })

    // Try to delete the submission via API - should fail with 401
    const response = await page.request.delete(
      `/api/admin/delete-submission/${submission.id}`
    )
    expect(response.status()).toBe(401)

    // Verify submission still exists
    const existingSubmission = await prisma.submission.findUnique({
      where: { id: submission.id },
    })
    expect(existingSubmission).not.toBeNull()

    // Cleanup
    await prisma.submission.delete({ where: { id: submission.id } })
    await prisma.show.delete({ where: { id: show.id } })
  })

  test("should prevent unauthenticated users from deleting submissions", async ({
    page,
  }) => {
    // Create a dummy submission ID
    const dummyId = "dummy-submission-id"

    // Try to delete without logging in - should fail with 401
    const response = await page.request.delete(
      `/api/admin/delete-submission/${dummyId}`
    )
    expect(response.status()).toBe(401)
  })

  test("should allow admin to reset show", async ({
    page,
    createAdmin,
    prisma,
  }) => {
    // Create admin user
    const adminEmail = `admin-reset-${Date.now()}@example.com`
    const adminUsername = `admin${Date.now()}`
    const adminPassword = "AdminPassword123!"

    await createAdmin({
      email: adminEmail,
      username: adminUsername,
      password: adminPassword,
      verified: true,
    })

    // Create a test show with unique date
    const testDate = new Date()
    testDate.setFullYear(2030)
    testDate.setMonth(2) // Different month
    testDate.setMilliseconds(Date.now() % 1000)

    const show = await prisma.show.create({
      data: {
        venue: "Test Venue Reset",
        city: "Test City",
        state: "NY",
        showDate: testDate,
        isComplete: true,
        setlistJson: { songs: ["Test Song"] },
        lastScoredAt: new Date(),
      },
    })

    // Login as admin
    await page.goto("/login")
    await page.getByPlaceholder("Email address").fill(adminEmail)
    await page.getByPlaceholder("Password").fill(adminPassword)
    await page.click('button[type="submit"]')
    await expect(page).toHaveURL(/\/picks/, { timeout: 10000 })

    // Reset the show via API
    const response = await page.request.post("/api/admin/reset-show", {
      data: { showId: show.id },
    })
    expect(response.status()).toBe(200)

    // Verify show was reset
    const resetShow = await prisma.show.findUnique({
      where: { id: show.id },
    })
    expect(resetShow?.isComplete).toBe(false)
    expect(resetShow?.setlistJson).toBeNull()
    expect(resetShow?.lastScoredAt).toBeNull()

    // Cleanup
    await prisma.show.delete({ where: { id: show.id } })
  })

  test("should prevent non-admin from resetting show", async ({
    page,
    createUser,
    prisma,
  }) => {
    // Create regular user
    const userEmail = `user-reset-${Date.now()}@example.com`
    const userUsername = `user${Date.now()}`
    const userPassword = "UserPassword123!"

    await createUser({
      email: userEmail,
      username: userUsername,
      password: userPassword,
      verified: true,
    })

    // Create a test show with unique date
    const testDate = new Date()
    testDate.setFullYear(2030)
    testDate.setMonth(3) // Different month
    testDate.setMilliseconds(Date.now() % 1000)

    const show = await prisma.show.create({
      data: {
        venue: "Test Venue Reset NonAdmin",
        city: "Test City",
        state: "NY",
        showDate: testDate,
        isComplete: true,
      },
    })

    // Login as regular user
    await page.goto("/login")
    await page.getByPlaceholder("Email address").fill(userEmail)
    await page.getByPlaceholder("Password").fill(userPassword)
    await page.click('button[type="submit"]')
    await expect(page).toHaveURL(/\/picks/, { timeout: 10000 })

    // Try to reset the show via API - should fail with 401
    const response = await page.request.post("/api/admin/reset-show", {
      data: { showId: show.id },
    })
    expect(response.status()).toBe(401)

    // Verify show was not reset
    const unchangedShow = await prisma.show.findUnique({
      where: { id: show.id },
    })
    expect(unchangedShow?.isComplete).toBe(true)

    // Cleanup
    await prisma.show.delete({ where: { id: show.id } })
  })

  test("should allow admin to create test submissions", async ({
    page,
    createAdmin,
    prisma,
  }) => {
    // Create admin user
    const adminEmail = `admin-testsub-${Date.now()}@example.com`
    const adminUsername = `admin${Date.now()}`
    const adminPassword = "AdminPassword123!"

    await createAdmin({
      email: adminEmail,
      username: adminUsername,
      password: adminPassword,
      verified: true,
    })

    // Create a test show with unique date
    const testDate = new Date()
    testDate.setFullYear(2030)
    testDate.setMonth(4) // Different month
    testDate.setMilliseconds(Date.now() % 1000)

    const show = await prisma.show.create({
      data: {
        venue: "Test Venue Submission",
        city: "Test City",
        state: "NY",
        showDate: testDate,
        isComplete: false,
      },
    })

    // Get songs for picks
    const songs = await prisma.song.findMany({ take: 13 })
    if (songs.length < 13) throw new Error("Not enough songs in database")

    const picks = [
      { songId: songs[0].id, pickType: "OPENER" },
      { songId: songs[1].id, pickType: "ENCORE" },
      ...songs.slice(2, 13).map((song) => ({
        songId: song.id,
        pickType: "REGULAR" as const,
      })),
    ]

    // Login as admin
    await page.goto("/login")
    await page.getByPlaceholder("Email address").fill(adminEmail)
    await page.getByPlaceholder("Password").fill(adminPassword)
    await page.click('button[type="submit"]')
    await expect(page).toHaveURL(/\/picks/, { timeout: 10000 })

    // Create test submission via API
    const response = await page.request.post(
      "/api/admin/create-test-submission",
      {
        data: { showId: show.id, picks },
      }
    )
    expect(response.status()).toBe(200)

    // Verify submission was created
    const admin = await prisma.user.findUnique({
      where: { email: adminEmail.toLowerCase() },
    })
    const submission = await prisma.submission.findFirst({
      where: {
        userId: admin!.id,
        showId: show.id,
      },
      include: { picks: true },
    })
    expect(submission).not.toBeNull()
    expect(submission?.picks.length).toBe(13)

    // Cleanup
    await prisma.submission.delete({ where: { id: submission!.id } })
    await prisma.show.delete({ where: { id: show.id } })
  })

  test("should prevent non-admin from creating test submissions", async ({
    page,
    createUser,
    prisma,
  }) => {
    // Create regular user
    const userEmail = `user-testsub-${Date.now()}@example.com`
    const userUsername = `user${Date.now()}`
    const userPassword = "UserPassword123!"

    await createUser({
      email: userEmail,
      username: userUsername,
      password: userPassword,
      verified: true,
    })

    // Create a test show with unique date
    const testDate = new Date()
    testDate.setFullYear(2030)
    testDate.setMonth(5) // Different month
    testDate.setMilliseconds(Date.now() % 1000)

    const show = await prisma.show.create({
      data: {
        venue: "Test Venue Sub NonAdmin",
        city: "Test City",
        state: "NY",
        showDate: testDate,
        isComplete: false,
      },
    })

    // Get songs for picks
    const songs = await prisma.song.findMany({ take: 13 })
    if (songs.length < 13) throw new Error("Not enough songs in database")

    const picks = [
      { songId: songs[0].id, pickType: "OPENER" },
      { songId: songs[1].id, pickType: "ENCORE" },
      ...songs.slice(2, 13).map((song) => ({
        songId: song.id,
        pickType: "REGULAR" as const,
      })),
    ]

    // Login as regular user
    await page.goto("/login")
    await page.getByPlaceholder("Email address").fill(userEmail)
    await page.getByPlaceholder("Password").fill(userPassword)
    await page.click('button[type="submit"]')
    await expect(page).toHaveURL(/\/picks/, { timeout: 10000 })

    // Try to create test submission via API - should fail with 401
    const response = await page.request.post(
      "/api/admin/create-test-submission",
      {
        data: { showId: show.id, picks },
      }
    )
    expect(response.status()).toBe(401)

    // Cleanup
    await prisma.show.delete({ where: { id: show.id } })
  })
})
