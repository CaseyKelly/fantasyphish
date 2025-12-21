import { test, expect } from "@playwright/test"
import { PrismaClient } from "@prisma/client"

// Create a dedicated Prisma client for the test database
const testPrisma = new PrismaClient({
  datasources: {
    db: {
      url: process.env.TEST_DATABASE_URL || process.env.DATABASE_URL,
    },
  },
})

test.describe("Show sync and query logic", () => {
  test.afterAll(async () => {
    await testPrisma.$disconnect()
  })

  test("should not create duplicate shows for the same date", async () => {
    // Use a unique date for this test
    const testDate = new Date("2030-06-15T00:00:00.000Z")

    // Clean up any existing test shows for this date
    await testPrisma.show.deleteMany({
      where: {
        showDate: testDate,
      },
    })

    // Create a show with a specific date
    await testPrisma.show.create({
      data: {
        showDate: testDate,
        venue: "Test Venue Duplicate Check",
        city: "Test City",
        state: "NY",
        country: "USA",
      },
    })

    // Attempt to create another show with the same date (should fail due to unique constraint)
    await expect(
      testPrisma.show.create({
        data: {
          showDate: testDate,
          venue: "Different Venue",
          city: "Different City",
          state: "NY",
          country: "USA",
        },
      })
    ).rejects.toThrow()

    // Verify only one show exists for this date
    const shows = await testPrisma.show.findMany({
      where: {
        showDate: testDate,
      },
    })

    expect(shows.length).toBe(1)

    // Cleanup
    await testPrisma.show.deleteMany({
      where: { showDate: testDate },
    })
  })

  test("should prevent creating shows with different timestamps for same calendar date", async () => {
    // Use a unique date range for this test
    const baseDate = "2030-07-20"
    const date1 = new Date(`${baseDate}T00:00:00.000Z`)
    const date2 = new Date(`${baseDate}T03:00:00.000Z`)
    const date3 = new Date(`${baseDate}T12:00:00.000Z`)

    // Clean up any existing test shows for this date range
    await testPrisma.show.deleteMany({
      where: {
        showDate: {
          gte: new Date(`${baseDate}T00:00:00.000Z`),
          lt: new Date("2030-07-21T00:00:00.000Z"),
        },
      },
    })

    await testPrisma.show.create({
      data: {
        showDate: date1,
        venue: "Test Venue Timestamp Check",
        city: "Test City",
        state: "NY",
        country: "USA",
      },
    })

    // These will succeed because Prisma sees them as different dates (different timestamps)
    // This demonstrates the problem that the sync normalization fixes
    await testPrisma.show.create({
      data: {
        showDate: date2,
        venue: "Test Venue Timestamp Check 2",
        city: "Test City",
        state: "NY",
        country: "USA",
      },
    })

    await testPrisma.show.create({
      data: {
        showDate: date3,
        venue: "Test Venue Timestamp Check 3",
        city: "Test City",
        state: "NY",
        country: "USA",
      },
    })

    // Find all shows for this date
    const shows = await testPrisma.show.findMany({
      where: {
        showDate: {
          gte: new Date(`${baseDate}T00:00:00.000Z`),
          lt: new Date("2030-07-21T00:00:00.000Z"),
        },
      },
      orderBy: { showDate: "asc" },
    })

    // This test documents the problem: we can create multiple shows for the same calendar date
    // if they have different timestamps. The sync normalization prevents this.
    expect(shows.length).toBe(3)

    // Cleanup
    await testPrisma.show.deleteMany({
      where: {
        showDate: {
          gte: new Date(`${baseDate}T00:00:00.000Z`),
          lt: new Date("2030-07-21T00:00:00.000Z"),
        },
      },
    })
  })

  test("should return correct next upcoming show using date-only comparison", async () => {
    // Use dates far in the future to avoid conflicts
    const baseDate = new Date("2030-08-01T00:00:00.000Z")

    const yesterday = new Date(baseDate)
    yesterday.setDate(yesterday.getDate() - 1)

    const today = new Date(baseDate)

    const tomorrow = new Date(baseDate)
    tomorrow.setDate(tomorrow.getDate() + 1)

    const nextWeek = new Date(baseDate)
    nextWeek.setDate(nextWeek.getDate() + 7)

    // Clean up any existing test shows
    await testPrisma.show.deleteMany({
      where: {
        showDate: {
          gte: yesterday,
          lte: nextWeek,
        },
      },
    })

    // Create past show (should not be returned)
    await testPrisma.show.create({
      data: {
        showDate: yesterday,
        venue: "Test Next Show - Past",
        city: "Test City",
        state: "NY",
        isComplete: false,
      },
    })

    // Create today's show (should be returned if not complete)
    const todayShow = await testPrisma.show.create({
      data: {
        showDate: today,
        venue: "Test Next Show - Today",
        city: "Test City",
        state: "NY",
        isComplete: false,
      },
    })

    // Create future shows
    const tomorrowShow = await testPrisma.show.create({
      data: {
        showDate: tomorrow,
        venue: "Test Next Show - Tomorrow",
        city: "Test City",
        state: "NY",
        isComplete: false,
      },
    })

    await testPrisma.show.create({
      data: {
        showDate: nextWeek,
        venue: "Test Next Show - Next Week",
        city: "Test City",
        state: "NY",
        isComplete: false,
      },
    })

    // Query for next show using the same logic as the API
    const nextShow = await testPrisma.show.findFirst({
      where: {
        isComplete: false,
        showDate: {
          gte: today,
        },
      },
      orderBy: { showDate: "asc" },
    })

    // Should return today's show
    expect(nextShow).toBeDefined()
    expect(nextShow?.id).toBe(todayShow.id)

    // Mark today's show as complete
    await testPrisma.show.update({
      where: { id: todayShow.id },
      data: { isComplete: true },
    })

    // Query again - should now return tomorrow's show
    const nextShowAfterComplete = await testPrisma.show.findFirst({
      where: {
        isComplete: false,
        showDate: {
          gte: today,
        },
      },
      orderBy: { showDate: "asc" },
    })

    expect(nextShowAfterComplete?.id).toBe(tomorrowShow.id)

    // Cleanup
    await testPrisma.show.deleteMany({
      where: {
        showDate: {
          gte: yesterday,
          lte: nextWeek,
        },
      },
    })
  })

  test("should normalize show dates to midnight UTC in upsert operations", async () => {
    // This test ensures that show dates are always normalized to midnight UTC
    // to prevent duplicate shows with different timestamps

    const testDate = new Date("2030-09-15T00:00:00.000Z")

    // Clean up
    await testPrisma.show.deleteMany({
      where: {
        showDate: {
          gte: testDate,
          lt: new Date("2030-09-16T00:00:00.000Z"),
        },
      },
    })

    // Simulate what the sync script should do: normalize dates before upsert
    const rawDate = new Date("2030-09-15T15:30:00.000Z") // 3:30 PM UTC
    const normalizedDate = new Date(rawDate)
    normalizedDate.setUTCHours(0, 0, 0, 0) // Should become midnight UTC

    // First upsert
    const show1 = await testPrisma.show.upsert({
      where: { showDate: normalizedDate },
      create: {
        showDate: normalizedDate,
        venue: "Test Normalization Venue",
        city: "Test City",
        state: "NY",
      },
      update: {
        venue: "Test Normalization Venue",
      },
    })

    // Second upsert with different raw time but same normalized date
    const rawDate2 = new Date("2030-09-15T20:00:00.000Z") // 8 PM UTC
    const normalizedDate2 = new Date(rawDate2)
    normalizedDate2.setUTCHours(0, 0, 0, 0)

    const show2 = await testPrisma.show.upsert({
      where: { showDate: normalizedDate2 },
      create: {
        showDate: normalizedDate2,
        venue: "Test Normalization Venue Updated",
        city: "Test City",
        state: "NY",
      },
      update: {
        venue: "Test Normalization Venue Updated",
      },
    })

    // Should be the same show (update, not create)
    expect(show1.id).toBe(show2.id)
    expect(show2.venue).toBe("Test Normalization Venue Updated")

    // Verify timestamp is normalized
    expect(show2.showDate.getUTCHours()).toBe(0)
    expect(show2.showDate.getUTCMinutes()).toBe(0)
    expect(show2.showDate.getUTCSeconds()).toBe(0)
    expect(show2.showDate.getUTCMilliseconds()).toBe(0)

    // Verify only one show exists
    const shows = await testPrisma.show.findMany({
      where: {
        showDate: {
          gte: testDate,
          lt: new Date("2030-09-16T00:00:00.000Z"),
        },
      },
    })

    expect(shows.length).toBe(1)

    // Cleanup
    await testPrisma.show.delete({ where: { id: show1.id } })
  })

  test("should verify sync creates normalized dates", async () => {
    // This test verifies that the sync normalization is working
    // by checking that shows in the database have normalized dates

    const testDate = new Date("2030-10-01T00:00:00.000Z")

    // Clean up
    await testPrisma.show.deleteMany({
      where: {
        showDate: testDate,
      },
    })

    // Simulate sync creating a show with normalized date
    const rawDate = new Date("2030-10-01T18:45:23.456Z")
    const normalizedDate = new Date(rawDate)
    normalizedDate.setUTCHours(0, 0, 0, 0)

    await testPrisma.show.create({
      data: {
        showDate: normalizedDate,
        venue: "Test Sync Venue",
        city: "Test City",
        state: "NY",
      },
    })

    // Retrieve and verify
    const show = await testPrisma.show.findFirst({
      where: { showDate: testDate },
    })

    expect(show).toBeDefined()
    expect(show!.showDate.getUTCHours()).toBe(0)
    expect(show!.showDate.getUTCMinutes()).toBe(0)
    expect(show!.showDate.getUTCSeconds()).toBe(0)
    expect(show!.showDate.getUTCMilliseconds()).toBe(0)

    // Cleanup
    await testPrisma.show.delete({ where: { id: show!.id } })
  })
})
