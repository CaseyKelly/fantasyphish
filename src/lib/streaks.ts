import { prisma } from "@/lib/prisma"
import { withRetry } from "@/lib/db-retry"

export interface StreakStats {
  current: number
  best: number
}

// Streak length at which reminders call out the streak and the leaderboard
// shows a 🔥. A 1- or 2-show "streak" reads as noise rather than something
// worth protecting.
export const STREAK_HIGHLIGHT_MIN = 3

// Shows at venues containing this marker are test fixtures; they never count
// toward (or break) a streak, matching leaderboard filtering.
export const TEST_VENUE_MARKER = "Test Venue"

export function isTestVenue(venue: string): boolean {
  return venue.includes(TEST_VENUE_MARKER)
}

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
          NOT: { venue: { contains: TEST_VENUE_MARKER } },
        },
        select: { id: true },
        orderBy: { showDate: "asc" },
      }),
    { operationName: "find locked shows for streaks" }
  )
  return shows.map((s) => s.id)
}

/**
 * Group (userId, showId) submission rows into per-user streaks. Users in
 * `userIds` with no submissions get zero streaks.
 */
export function buildStreakMap(
  lockedShowIds: string[],
  submissions: { userId: string; showId: string }[],
  userIds: Iterable<string>
): Map<string, StreakStats> {
  const submittedByUser = new Map<string, Set<string>>()
  for (const { userId, showId } of submissions) {
    let set = submittedByUser.get(userId)
    if (!set) {
      set = new Set()
      submittedByUser.set(userId, set)
    }
    set.add(showId)
  }

  const result = new Map<string, StreakStats>()
  for (const userId of userIds) {
    result.set(
      userId,
      computeStreaks(lockedShowIds, submittedByUser.get(userId) ?? new Set())
    )
  }
  return result
}

/**
 * Current and best streaks for a batch of users, sharing a single locked-show
 * lookup and a single submissions query.
 */
export async function getStreaksForUsers(
  userIds: string[],
  now: Date = new Date()
): Promise<Map<string, StreakStats>> {
  if (userIds.length === 0) return new Map()

  const [lockedShowIds, submissions] = await Promise.all([
    getLockedShowIds(now),
    withRetry(
      () =>
        prisma.submission.findMany({
          where: { userId: { in: userIds } },
          select: { userId: true, showId: true },
        }),
      { operationName: "find submissions for streaks" }
    ),
  ])

  return buildStreakMap(lockedShowIds, submissions, userIds)
}

/**
 * Current and best streaks for every user who has ever submitted picks.
 */
export async function getStreaksForAllUsers(
  now: Date = new Date()
): Promise<Map<string, StreakStats>> {
  const [lockedShowIds, submissions] = await Promise.all([
    getLockedShowIds(now),
    withRetry(
      () =>
        prisma.submission.findMany({
          select: { userId: true, showId: true },
        }),
      { operationName: "find all submissions for streaks" }
    ),
  ])

  return buildStreakMap(
    lockedShowIds,
    submissions,
    new Set(submissions.map((s) => s.userId))
  )
}
