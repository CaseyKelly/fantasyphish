import { prisma } from "@/lib/prisma"
import { withRetry } from "@/lib/db-retry"

export interface StreakStats {
  current: number
  best: number
}

// Streak length at which reminders start calling out the streak. A 1- or
// 2-show "streak" reads as noise rather than something worth protecting.
export const STREAK_REMINDER_MIN = 3

/**
 * Compute current and best show streaks from the ordered list of locked
 * shows (oldest first) and the set of show IDs the user submitted picks for.
 *
 * Only locked shows belong in `lockedShowIds`: a show that hasn't locked yet
 * can still be picked, so it must not break the current streak.
 */
export function computeStreaks(
  lockedShowIds: string[],
  submittedShowIds: Set<string>
): StreakStats {
  let run = 0
  let best = 0
  for (const showId of lockedShowIds) {
    if (submittedShowIds.has(showId)) {
      run++
      if (run > best) best = run
    } else {
      run = 0
    }
  }
  return { current: run, best }
}

/**
 * IDs of every real show whose picks have locked, oldest first. Test-venue
 * shows are excluded to match leaderboard filtering.
 */
export async function getLockedShowIds(
  now: Date = new Date()
): Promise<string[]> {
  const shows = await withRetry(
    () =>
      prisma.show.findMany({
        where: {
          lockTime: { lte: now },
          NOT: { venue: { contains: "Test Venue" } },
        },
        select: { id: true },
        orderBy: { showDate: "asc" },
      }),
    { operationName: "find locked shows for streaks" }
  )
  return shows.map((s) => s.id)
}

/**
 * Current and best streaks for a batch of users, sharing a single locked-show
 * lookup and a single submissions query.
 */
export async function getStreaksForUsers(
  userIds: string[],
  now: Date = new Date()
): Promise<Map<string, StreakStats>> {
  const result = new Map<string, StreakStats>()
  if (userIds.length === 0) return result

  const lockedShowIds = await getLockedShowIds(now)
  const submissions = await withRetry(
    () =>
      prisma.submission.findMany({
        where: { userId: { in: userIds } },
        select: { userId: true, showId: true },
      }),
    { operationName: "find submissions for streaks" }
  )

  const submittedByUser = new Map<string, Set<string>>()
  for (const { userId, showId } of submissions) {
    let set = submittedByUser.get(userId)
    if (!set) {
      set = new Set()
      submittedByUser.set(userId, set)
    }
    set.add(showId)
  }

  for (const userId of userIds) {
    result.set(
      userId,
      computeStreaks(lockedShowIds, submittedByUser.get(userId) ?? new Set())
    )
  }
  return result
}
