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

test.describe("Polls API", () => {
  test("API only accepts one valid vote per user", async ({
    page,
    createUser,
    prisma,
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

    // Voting earns the Sample in a Jar achievement
    const user = await prisma.user.findUniqueOrThrow({ where: { email } })
    const award = await prisma.userAchievement.findFirst({
      where: { userId: user.id, achievement: { slug: "sample-in-a-jar" } },
      include: { achievement: true },
    })
    expect(award?.achievement.name).toBe("Sample in a Jar")

    const second = await page.request.post(POLL_API, {
      data: { option: "yes" },
    })
    expect(second.status()).toBe(409)
    expect((await second.json()).userVote).toBe("no")

    const unknownPoll = await page.request.get("/api/polls/does-not-exist")
    expect(unknownPoll.status()).toBe(404)
  })
})
