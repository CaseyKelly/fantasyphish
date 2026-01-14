import { prisma } from "@/lib/prisma"
import { withRetry } from "@/lib/db-retry"

/**
 * Check if cron jobs should run based on tour status
 * Cron jobs only run when at least one tour has status = 'ACTIVE'
 * This prevents unnecessary database usage during off-season
 */
export async function shouldRunCronJobs(): Promise<{
  shouldRun: boolean
  reason?: string
}> {
  return withRetry(
    async () => {
      const activeToursCount = await prisma.tour.count({
        where: {
          status: "ACTIVE",
        },
      })

      if (activeToursCount === 0) {
        return {
          shouldRun: false,
          reason: "No active tours",
        }
      }

      return {
        shouldRun: true,
      }
    },
    {
      operationName: "shouldRunCronJobs",
      maxRetries: 3,
      delayMs: 1000,
    }
  )
}
