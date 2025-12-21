import { test, expect } from "./helpers/fixtures"

test.describe.configure({ mode: "serial" })

test.describe("Song Picker Flow", () => {
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
})
