import { test, expect, uniqueUsername } from "./helpers/fixtures"
import AxeBuilder from "@axe-core/playwright"

test.describe.configure({ mode: "serial" })

test.describe("Song Picker Flow", () => {
  test("pick page should have no automatically detectable accessibility violations", async ({
    page,
    createUser,
    prisma,
  }) => {
    const userUsername = uniqueUsername("pickera11y")
    const userEmail = `${userUsername}@example.com`
    const userPassword = "PickerPassword123!"

    await createUser({
      email: userEmail,
      username: userUsername,
      password: userPassword,
      verified: true,
    })

    const futureDate = new Date()
    futureDate.setDate(futureDate.getDate() + 31)

    const show = await prisma.show.create({
      data: {
        venue: "Test Venue Picker A11y",
        city: "Test City",
        state: "NY",
        showDate: futureDate,
        isComplete: false,
      },
    })

    try {
      await page.goto("/login")
      await page.getByPlaceholder("Email address").fill(userEmail)
      await page.getByPlaceholder("Password").fill(userPassword)
      await page.click('button[type="submit"]')
      await expect(page).toHaveURL(/\/picks/, { timeout: 10000 })

      await page.goto(`/pick/${show.id}`)
      await expect(page.getByText("Opener Pick")).toBeVisible()

      const results = await new AxeBuilder({ page })
        .withTags(["wcag2a", "wcag2aa"])
        .analyze()
      expect(results.violations).toEqual([])
    } finally {
      await prisma.show.delete({ where: { id: show.id } })
    }
  })

  test("should allow user to submit picks for a show", async ({
    page,
    createUser,
    prisma,
  }) => {
    // Create user
    const userEmail = `picker-${Date.now()}@example.com`
    const userUsername = `picker${Date.now()}`
    const userPassword = "PickerPassword123!"

    await createUser({
      email: userEmail,
      username: userUsername,
      password: userPassword,
      verified: true,
    })

    // Create a future test show
    const futureDate = new Date()
    futureDate.setDate(futureDate.getDate() + 30) // 30 days in future

    const show = await prisma.show.create({
      data: {
        venue: "Test Venue Picker",
        city: "Test City",
        state: "NY",
        showDate: futureDate,

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

    // Login
    await page.goto("/login")
    await page.getByPlaceholder("Email address").fill(userEmail)
    await page.getByPlaceholder("Password").fill(userPassword)
    await page.click('button[type="submit"]')
    await expect(page).toHaveURL(/\/picks/, { timeout: 10000 })

    // Submit picks via API
    const response = await page.request.post("/api/picks", {
      data: { showId: show.id, picks },
    })
    expect(response.status()).toBe(200)

    const data = await response.json()
    expect(data.success).toBe(true)

    // Verify submission was created
    const user = await prisma.user.findUnique({
      where: { email: userEmail.toLowerCase() },
    })
    const submission = await prisma.submission.findFirst({
      where: {
        userId: user!.id,
        showId: show.id,
      },
      include: { picks: true },
    })
    expect(submission).not.toBeNull()
    expect(submission?.picks.length).toBe(13)

    // Verify pick types
    const openerPicks = submission?.picks.filter((p) => p.pickType === "OPENER")
    const encorePicks = submission?.picks.filter((p) => p.pickType === "ENCORE")
    const regularPicks = submission?.picks.filter(
      (p) => p.pickType === "REGULAR"
    )

    expect(openerPicks?.length).toBe(1)
    expect(encorePicks?.length).toBe(1)
    expect(regularPicks?.length).toBe(11)

    // Cleanup
    await prisma.submission.delete({ where: { id: submission!.id } })
    await prisma.show.delete({ where: { id: show.id } })
  })

  test("should allow user to update existing picks", async ({
    page,
    createUser,
    prisma,
  }) => {
    // Create user
    const userEmail = `picker-update-${Date.now()}@example.com`
    const userUsername = `pickerupdate${Date.now()}`
    const userPassword = "PickerPassword123!"

    await createUser({
      email: userEmail,
      username: userUsername,
      password: userPassword,
      verified: true,
    })

    // Get user from DB
    const user = await prisma.user.findUnique({
      where: { email: userEmail.toLowerCase() },
    })

    // Create a future test show
    const futureDate = new Date()
    futureDate.setDate(futureDate.getDate() + 30)

    const show = await prisma.show.create({
      data: {
        venue: "Test Venue Update",
        city: "Test City",
        state: "NY",
        showDate: futureDate,

        isComplete: false,
      },
    })

    // Get songs for picks
    const songs = await prisma.song.findMany({ take: 15 })
    if (songs.length < 15) throw new Error("Not enough songs in database")

    // Create initial submission
    const initialSubmission = await prisma.submission.create({
      data: {
        userId: user!.id,
        showId: show.id,
        picks: {
          create: [
            { songId: songs[0].id, pickType: "OPENER" },
            { songId: songs[1].id, pickType: "ENCORE" },
            ...songs.slice(2, 13).map((song) => ({
              songId: song.id,
              pickType: "REGULAR" as const,
            })),
          ],
        },
      },
    })

    // Login
    await page.goto("/login")
    await page.getByPlaceholder("Email address").fill(userEmail)
    await page.getByPlaceholder("Password").fill(userPassword)
    await page.click('button[type="submit"]')
    await expect(page).toHaveURL(/\/picks/, { timeout: 10000 })

    // Update picks with different songs
    const updatedPicks = [
      { songId: songs[13].id, pickType: "OPENER" },
      { songId: songs[14].id, pickType: "ENCORE" },
      ...songs.slice(2, 13).map((song) => ({
        songId: song.id,
        pickType: "REGULAR" as const,
      })),
    ]

    const response = await page.request.post("/api/picks", {
      data: { showId: show.id, picks: updatedPicks },
    })
    expect(response.status()).toBe(200)

    const data = await response.json()
    expect(data.success).toBe(true)
    expect(data.message).toContain("updated")

    // Verify picks were updated
    const submission = await prisma.submission.findUnique({
      where: { id: initialSubmission.id },
      include: { picks: true },
    })
    expect(submission?.picks.length).toBe(13)

    const openerPick = submission?.picks.find((p) => p.pickType === "OPENER")
    expect(openerPick?.songId).toBe(songs[13].id)

    const encorePick = submission?.picks.find((p) => p.pickType === "ENCORE")
    expect(encorePick?.songId).toBe(songs[14].id)

    // Cleanup
    await prisma.submission.delete({ where: { id: submission!.id } })
    await prisma.show.delete({ where: { id: show.id } })
  })

  test("should reject picks with wrong count", async ({
    page,
    createUser,
    prisma,
  }) => {
    // Create user
    const userEmail = `picker-wrongcount-${Date.now()}@example.com`
    const userUsername = `pickerwrong${Date.now()}`
    const userPassword = "PickerPassword123!"

    await createUser({
      email: userEmail,
      username: userUsername,
      password: userPassword,
      verified: true,
    })

    // Create a future test show
    const futureDate = new Date()
    futureDate.setDate(futureDate.getDate() + 30)

    const show = await prisma.show.create({
      data: {
        venue: "Test Venue Wrong Count",
        city: "Test City",
        state: "NY",
        showDate: futureDate,

        isComplete: false,
      },
    })

    // Get songs
    const songs = await prisma.song.findMany({ take: 10 })

    // Login
    await page.goto("/login")
    await page.getByPlaceholder("Email address").fill(userEmail)
    await page.getByPlaceholder("Password").fill(userPassword)
    await page.click('button[type="submit"]')
    await expect(page).toHaveURL(/\/picks/, { timeout: 10000 })

    // Try with too few picks
    const tooFewPicks = [
      { songId: songs[0].id, pickType: "OPENER" },
      { songId: songs[1].id, pickType: "ENCORE" },
      { songId: songs[2].id, pickType: "REGULAR" },
    ]

    const response1 = await page.request.post("/api/picks", {
      data: { showId: show.id, picks: tooFewPicks },
    })
    expect(response1.status()).toBe(400)
    const data1 = await response1.json()
    expect(data1.error).toContain("11 regular songs")

    // Try with no opener
    const noOpener = [
      { songId: songs[0].id, pickType: "ENCORE" },
      ...songs.slice(1, 12).map((song) => ({
        songId: song.id,
        pickType: "REGULAR" as const,
      })),
    ]

    const response2 = await page.request.post("/api/picks", {
      data: { showId: show.id, picks: noOpener },
    })
    expect(response2.status()).toBe(400)
    const data2 = await response2.json()
    expect(data2.error).toContain("1 opener")

    // Cleanup
    await prisma.show.delete({ where: { id: show.id } })
  })

  test("should reject duplicate songs in picks", async ({
    page,
    createUser,
    prisma,
  }) => {
    // Create user
    const userEmail = `picker-dupes-${Date.now()}@example.com`
    const userUsername = `pickerdupes${Date.now()}`
    const userPassword = "PickerPassword123!"

    await createUser({
      email: userEmail,
      username: userUsername,
      password: userPassword,
      verified: true,
    })

    // Create a future test show
    const futureDate = new Date()
    futureDate.setDate(futureDate.getDate() + 30)

    const show = await prisma.show.create({
      data: {
        venue: "Test Venue Dupes",
        city: "Test City",
        state: "NY",
        showDate: futureDate,

        isComplete: false,
      },
    })

    // Get songs
    const songs = await prisma.song.findMany({ take: 13 })

    // Login
    await page.goto("/login")
    await page.getByPlaceholder("Email address").fill(userEmail)
    await page.getByPlaceholder("Password").fill(userPassword)
    await page.click('button[type="submit"]')
    await expect(page).toHaveURL(/\/picks/, { timeout: 10000 })

    // Try with duplicate songs (same song picked twice)
    const duplicatePicks = [
      { songId: songs[0].id, pickType: "OPENER" },
      { songId: songs[1].id, pickType: "ENCORE" },
      { songId: songs[0].id, pickType: "REGULAR" }, // duplicate!
      ...songs.slice(2, 12).map((song) => ({
        songId: song.id,
        pickType: "REGULAR" as const,
      })),
    ]

    const response = await page.request.post("/api/picks", {
      data: { showId: show.id, picks: duplicatePicks },
    })
    expect(response.status()).toBe(400)
    const data = await response.json()
    expect(data.error).toContain("same song twice")

    // Cleanup
    await prisma.show.delete({ where: { id: show.id } })
  })

  test("should prevent picks submission after show starts", async ({
    page,
    createUser,
    prisma,
  }) => {
    // Create user
    const userEmail = `picker-locked-${Date.now()}@example.com`
    const userUsername = `pickerlocked${Date.now()}`
    const userPassword = "PickerPassword123!"

    await createUser({
      email: userEmail,
      username: userUsername,
      password: userPassword,
      verified: true,
    })

    // Create a past show (already started)
    const pastDate = new Date()
    pastDate.setDate(pastDate.getDate() - 1) // yesterday

    const show = await prisma.show.create({
      data: {
        venue: "Test Venue Locked",
        city: "Test City",
        state: "NY",
        showDate: pastDate,

        isComplete: false,
      },
    })

    // Get songs
    const songs = await prisma.song.findMany({ take: 13 })

    const picks = [
      { songId: songs[0].id, pickType: "OPENER" },
      { songId: songs[1].id, pickType: "ENCORE" },
      ...songs.slice(2, 13).map((song) => ({
        songId: song.id,
        pickType: "REGULAR" as const,
      })),
    ]

    // Login
    await page.goto("/login")
    await page.getByPlaceholder("Email address").fill(userEmail)
    await page.getByPlaceholder("Password").fill(userPassword)
    await page.click('button[type="submit"]')
    await expect(page).toHaveURL(/\/picks/, { timeout: 10000 })

    // Try to submit picks for past show
    const response = await page.request.post("/api/picks", {
      data: { showId: show.id, picks },
    })
    expect(response.status()).toBe(400)
    const data = await response.json()
    expect(data.error).toContain("already started")

    // Cleanup
    await prisma.show.delete({ where: { id: show.id } })
  })

  test("should require authentication to submit picks", async ({
    page,
    prisma,
  }) => {
    // Create a show without logging in
    const futureDate = new Date()
    futureDate.setDate(futureDate.getDate() + 30)

    const show = await prisma.show.create({
      data: {
        venue: "Test Venue Unauth",
        city: "Test City",
        state: "NY",
        showDate: futureDate,

        isComplete: false,
      },
    })

    // Get songs
    const songs = await prisma.song.findMany({ take: 13 })

    const picks = [
      { songId: songs[0].id, pickType: "OPENER" },
      { songId: songs[1].id, pickType: "ENCORE" },
      ...songs.slice(2, 13).map((song) => ({
        songId: song.id,
        pickType: "REGULAR" as const,
      })),
    ]

    // Try to submit picks without authentication
    const response = await page.request.post("/api/picks", {
      data: { showId: show.id, picks },
    })
    expect(response.status()).toBe(401)

    // Cleanup
    await prisma.show.delete({ where: { id: show.id } })
  })

  test("should get user's submission for a show", async ({
    page,
    createUser,
    prisma,
  }) => {
    // Create user
    const userEmail = `picker-get-${Date.now()}@example.com`
    const userUsername = `pickerget${Date.now()}`
    const userPassword = "PickerPassword123!"

    await createUser({
      email: userEmail,
      username: userUsername,
      password: userPassword,
      verified: true,
    })

    // Get user from DB
    const user = await prisma.user.findUnique({
      where: { email: userEmail.toLowerCase() },
    })

    // Create a future test show
    const futureDate = new Date()
    futureDate.setDate(futureDate.getDate() + 30)

    const show = await prisma.show.create({
      data: {
        venue: "Test Venue Get",
        city: "Test City",
        state: "NY",
        showDate: futureDate,

        isComplete: false,
      },
    })

    // Get songs
    const songs = await prisma.song.findMany({ take: 13 })

    // Create submission
    const submission = await prisma.submission.create({
      data: {
        userId: user!.id,
        showId: show.id,
        picks: {
          create: [
            { songId: songs[0].id, pickType: "OPENER" },
            { songId: songs[1].id, pickType: "ENCORE" },
            ...songs.slice(2, 13).map((song) => ({
              songId: song.id,
              pickType: "REGULAR" as const,
            })),
          ],
        },
      },
    })

    // Login
    await page.goto("/login")
    await page.getByPlaceholder("Email address").fill(userEmail)
    await page.getByPlaceholder("Password").fill(userPassword)
    await page.click('button[type="submit"]')
    await expect(page).toHaveURL(/\/picks/, { timeout: 10000 })

    // Get submission via API
    const response = await page.request.get(`/api/picks?showId=${show.id}`)
    expect(response.status()).toBe(200)

    const data = await response.json()
    expect(data.submission).not.toBeNull()
    expect(data.submission.id).toBe(submission.id)
    expect(data.submission.picks.length).toBe(13)

    // Cleanup
    await prisma.submission.delete({ where: { id: submission.id } })
    await prisma.show.delete({ where: { id: show.id } })
  })

  test("should hide the reminder prompt once the user has notifications enabled", async ({
    page,
    createUser,
    prisma,
  }) => {
    // Create user
    const userEmail = `picker-reminder-${Date.now()}@example.com`
    const userUsername = `pickerreminder${Date.now()}`
    const userPassword = "PickerPassword123!"

    await createUser({
      email: userEmail,
      username: userUsername,
      password: userPassword,
      verified: true,
    })

    // Create a future test show
    const futureDate = new Date()
    futureDate.setDate(futureDate.getDate() + 30)

    const show = await prisma.show.create({
      data: {
        venue: "Test Venue Reminder",
        city: "Test City",
        state: "NY",
        showDate: futureDate,
        isComplete: false,
      },
    })

    // Login
    await page.goto("/login")
    await page.getByPlaceholder("Email address").fill(userEmail)
    await page.getByPlaceholder("Password").fill(userPassword)
    await page.click('button[type="submit"]')
    await expect(page).toHaveURL(/\/picks/, { timeout: 10000 })

    const reminderPrompt = page.getByText(/Want a reminder on show day/i)

    // Notifications are off by default, so the prompt should show
    await page.goto(`/pick/${show.id}`)
    await expect(reminderPrompt).toBeVisible()

    // Enable email reminders, then the prompt should disappear
    await prisma.user.update({
      where: { email: userEmail.toLowerCase() },
      data: { emailPickReminders: true },
    })
    await page.reload()
    await expect(reminderPrompt).not.toBeVisible()

    // Cleanup
    await prisma.show.delete({ where: { id: show.id } })
  })

  test("should restore an in-progress draft after reloading the page", async ({
    page,
    createUser,
    prisma,
  }) => {
    const userUsername = uniqueUsername("pickerdraft")
    const userEmail = `${userUsername}@example.com`
    const userPassword = "PickerPassword123!"

    await createUser({
      email: userEmail,
      username: userUsername,
      password: userPassword,
      verified: true,
    })

    const futureDate = new Date()
    futureDate.setDate(futureDate.getDate() + 32)

    const show = await prisma.show.create({
      data: {
        venue: "Test Venue Draft Restore",
        city: "Test City",
        state: "NY",
        showDate: futureDate,
        isComplete: false,
      },
    })

    try {
      const songs = await prisma.song.findMany({ take: 4 })
      if (songs.length < 4) throw new Error("Not enough songs in database")

      await page.goto("/login")
      await page.getByPlaceholder("Email address").fill(userEmail)
      await page.getByPlaceholder("Password").fill(userPassword)
      await page.click('button[type="submit"]')
      await expect(page).toHaveURL(/\/picks/, { timeout: 10000 })

      await page.goto(`/pick/${show.id}`)
      await expect(page.getByText("Opener Pick")).toBeVisible()

      const search = page.getByLabel("Search songs")

      // Opener
      await search.fill(songs[0].name)
      await page.getByRole("button", { name: songs[0].name }).first().click()

      // Encore (panel auto-expands after the opener pick)
      await search.fill(songs[1].name)
      await page.getByRole("button", { name: songs[1].name }).first().click()

      // Two regular picks (panel auto-expands after the encore pick)
      await search.fill(songs[2].name)
      await page.getByRole("button", { name: songs[2].name }).first().click()
      await search.fill(songs[3].name)
      await page.getByRole("button", { name: songs[3].name }).first().click()

      await expect(page.getByText("9 more needed")).toBeVisible()

      await page.reload()

      await expect(
        page.getByText("Restored your unsaved picks from last time")
      ).toBeVisible()
      await expect(page.getByText(songs[0].name).first()).toBeVisible()
      await expect(page.getByText(songs[1].name).first()).toBeVisible()
      await expect(page.getByText("9 more needed")).toBeVisible()
    } finally {
      await prisma.show.delete({ where: { id: show.id } })
    }
  })

  test("should clear the localStorage draft after successfully submitting picks", async ({
    page,
    createUser,
    prisma,
  }) => {
    const userUsername = uniqueUsername("pickerdraftclear")
    const userEmail = `${userUsername}@example.com`
    const userPassword = "PickerPassword123!"

    await createUser({
      email: userEmail,
      username: userUsername,
      password: userPassword,
      verified: true,
    })

    const futureDate = new Date()
    futureDate.setDate(futureDate.getDate() + 33)

    const show = await prisma.show.create({
      data: {
        venue: "Test Venue Draft Clear",
        city: "Test City",
        state: "NY",
        showDate: futureDate,
        isComplete: false,
      },
    })

    try {
      const songs = await prisma.song.findMany({ take: 13 })
      if (songs.length < 13) throw new Error("Not enough songs in database")

      await page.goto("/login")
      await page.getByPlaceholder("Email address").fill(userEmail)
      await page.getByPlaceholder("Password").fill(userPassword)
      await page.click('button[type="submit"]')
      await expect(page).toHaveURL(/\/picks/, { timeout: 10000 })

      await page.goto(`/pick/${show.id}`)
      await expect(page.getByText("Opener Pick")).toBeVisible()

      const search = page.getByLabel("Search songs")
      for (const song of songs) {
        await search.fill(song.name)
        await page.getByRole("button", { name: song.name }).first().click()
      }

      await expect(page.getByText("Complete")).toBeVisible()

      // Draft should exist in localStorage before submit.
      const keysBeforeSubmit = await page.evaluate(() =>
        Object.keys(window.localStorage).filter((k) =>
          k.startsWith("fp:draft-picks")
        )
      )
      expect(keysBeforeSubmit.length).toBeGreaterThan(0)

      await page.getByRole("button", { name: /Submit Picks/ }).click()
      await expect(
        page.getByText("Picks submitted successfully!")
      ).toBeVisible()

      const keysAfterSubmit = await page.evaluate(() =>
        Object.keys(window.localStorage).filter((k) =>
          k.startsWith("fp:draft-picks")
        )
      )
      expect(keysAfterSubmit).toEqual([])

      // Cleanup the submission this test created.
      const submission = await prisma.submission.findFirst({
        where: { showId: show.id },
      })
      if (submission) {
        await prisma.submission.delete({ where: { id: submission.id } })
      }
    } finally {
      await prisma.show.delete({ where: { id: show.id } })
    }
  })
})
