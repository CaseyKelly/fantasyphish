import { Prisma } from "@prisma/client"

/**
 * Prisma filter to exclude test shows created by Playwright tests.
 * Test shows have "test" in venue or city name (case-insensitive).
 *
 * Use this filter in any query that should exclude test data from production views.
 */
export const excludeTestShows: Prisma.ShowWhereInput = {
  NOT: {
    OR: [
      { venue: { contains: "test", mode: "insensitive" } },
      { city: { contains: "test", mode: "insensitive" } },
    ],
  },
}
