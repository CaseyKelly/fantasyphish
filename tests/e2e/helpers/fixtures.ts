import { test as base } from "@playwright/test"
import { PrismaClient } from "@prisma/client"
import crypto from "crypto"
import { hash } from "bcryptjs"

// Helper function to hash passwords (same as in registration route)
async function hashPassword(password: string): Promise<string> {
  return hash(password, 12)
}

// Helper function to create a user directly in the database (bypasses email sending)
export async function createTestUser(
  prisma: PrismaClient,
  options: {
    email: string
    username: string
    password: string
    verified?: boolean
  }
): Promise<{ email: string; username: string; password: string }> {
  const { email, username, password, verified = true } = options

  const hashedPassword = await hashPassword(password)

  await prisma.user.create({
    data: {
      email: email.toLowerCase(),
      username,
      passwordHash: hashedPassword,
      emailVerified: verified ? new Date() : null,
      verificationToken: verified
        ? null
        : crypto.randomBytes(32).toString("hex"),
    },
  })

  return { email, username, password }
}

// Extend the base test with database cleanup
export const test = base.extend<{
  cleanupEmail: (email: string) => Promise<void>
  prisma: PrismaClient
  createUser: (options: {
    email: string
    username: string
    password: string
    verified?: boolean
  }) => Promise<{ email: string; username: string; password: string }>
}>({
  // Provide a Prisma client for tests
  prisma: async ({}, use) => {
    const prisma = new PrismaClient()
    await use(prisma)
    await prisma.$disconnect()
  },

  // Helper to create test users directly in DB
  createUser: async ({ prisma, cleanupEmail }, use) => {
    await use(async (options) => {
      const result = await createTestUser(prisma, options)
      // Register for cleanup only after successful creation
      await cleanupEmail(options.email)
      return result
    })
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
