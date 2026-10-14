import { test, expect, uniqueUsername } from "./helpers/fixtures"
import type { Page } from "@playwright/test"
import { SET2_OPENER_POLL } from "@/lib/polls"

const POLL_API = `/api/polls/${SET2_OPENER_POLL.slug}`

async function login(page: Page, email: string, password: string) {
  await page.goto("/login")
  await page.getByPlaceholder("Email address").fill(email)
  await page.getByPlaceholder("Password").fill(password)
  await page.click('button[type="submit"]')
  await expect(page).toHaveURL(/\/picks/, { timeout: 10000 })
}

test.describe("Set 2 Opener format poll", () => {
  test("user votes once on /picks and then sees results", async ({
    page,
    createUser,
    prisma,
  }) => {
    const username = uniqueUsername("polluser")
    const email = `${username}@example.com`
    const password = "PollPassword123!"
    await createUser({ email, username, password, verified: true })

    await login(page, email, password)

    await expect(
      page.getByRole("heading", { name: SET2_OPENER_POLL.question })
    ).toBeVisible()
    const submit = page.getByRole("button", { name: "Submit Vote" })
    await expect(submit).toBeDisabled()

    await page.getByLabel("Yes, add a Set 2 Opener pick").check()
    await submit.click()

    await expect(page.getByText("Your vote")).toBeVisible()
    await expect(submit).toHaveCount(0)

    const user = await prisma.user.findUniqueOrThrow({ where: { email } })
    const vote = await prisma.pollVote.findUnique({
      where: {
        pollSlug_userId: { pollSlug: SET2_OPENER_POLL.slug, userId: user.id },
      },
    })
    expect(vote?.option).toBe("yes")

    // Voting earns the Sample in a Jar achievement
    const award = await prisma.userAchievement.findFirst({
      where: { userId: user.id, achievement: { slug: "sample-in-a-jar" } },
      include: { achievement: true },
    })
    expect(award?.achievement.name).toBe("Sample in a Jar")

    // Returning to the page shows results instead of asking again
    await page.reload()
    await expect(page.getByText("Your vote")).toBeVisible()
    await expect(page.getByRole("button", { name: "Submit Vote" })).toHaveCount(
      0
    )
  })

  test("API only accepts one valid vote per user", async ({
    page,
    createUser,
  }) => {
    const username = uniqueUsername("pollapi")
    const email = `${username}@example.com`
    const password = "PollPassword123!"
    await createUser({ email, username, password, verified: true })

    const unauthenticated = await page.request.post(POLL_API, {
      data: { option: "yes" },
    })
    expect(unauthenticated.status()).toBe(401)

    await login(page, email, password)

    const before = await page.request.get(POLL_API)
    expect(await before.json()).toEqual({ userVote: null, results: null })

    const invalid = await page.request.post(POLL_API, {
      data: { option: "maybe" },
    })
    expect(invalid.status()).toBe(400)

    const first = await page.request.post(POLL_API, {
      data: { option: "no" },
    })
    expect(first.status()).toBe(200)
    const firstBody = await first.json()
    expect(firstBody.userVote).toBe("no")
    expect(firstBody.results.totalVotes).toBeGreaterThanOrEqual(1)

    const second = await page.request.post(POLL_API, {
      data: { option: "yes" },
    })
    expect(second.status()).toBe(409)
    expect((await second.json()).userVote).toBe("no")

    const unknownPoll = await page.request.get("/api/polls/does-not-exist")
    expect(unknownPoll.status()).toBe(404)
  })
})
