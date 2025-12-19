import { test as base } from "@playwright/test"
import { PrismaClient } from "@prisma/client"

// Extend the base test with database cleanup
export const test = base.extend<{
  cleanupEmail: (email: string) => Promise<void>
  prisma: PrismaClient
}>({
  // Provide a Prisma client for tests
  prisma: async ({}, use) => {
    const prisma = new PrismaClient()
    await use(prisma)
    await prisma.$disconnect()
  },

  // Automatically cleanup test users after each test
  cleanupEmail: async ({ prisma }, use) => {
    const emailsToCleanup: string[] = []

    // Provide the cleanup function to the test
    await use(async (email: string) => {
      emailsToCleanup.push(email)
    })

    // After the test completes, delete all registered test users
    for (const email of emailsToCleanup) {
      try {
        await prisma.user.delete({
          where: { email: email.toLowerCase() },
        })
      } catch (error) {
        // User might not exist, which is fine
        console.log(`Could not delete user ${email}:`, error)
      }
    }
  },
})

export { expect } from "@playwright/test"
