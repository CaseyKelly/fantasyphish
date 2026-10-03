import { AchievementCategory } from "@prisma/client"

export interface AchievementDefinition {
  slug: string
  name: string
  description: string
  icon: string
  category: AchievementCategory
  metadata?: Record<string, unknown>
}

export const ACHIEVEMENT_DEFINITIONS = {
  FOUNDING_MEMBER: {
    slug: "founding-member",
    name: "Founding Member",
    description: "Played the first game for the site's launch",
    icon: "Baby",
    category: "SPECIAL" as AchievementCategory,
    metadata: {
      year: 2024,
    },
  },
  PERFECT_OPENER: {
    slug: "perfect-opener",
    name: "Perfect Opener",
    description: "Correctly guessed a show opener",
    icon: "PlaneTakeoff",
    category: "MILESTONE" as AchievementCategory,
  },
  PERFECT_CLOSER: {
    slug: "perfect-closer",
    name: "Perfect Closer",
    description: "Correctly guessed an encore song",
    icon: "PlaneLanding",
    category: "MILESTONE" as AchievementCategory,
  },
  JACKPOT: {
    slug: "jackpot",
    name: "Jackpot",
    description: "Picked Harpua and had it played",
    icon: "Cat",
    category: "SPECIAL" as AchievementCategory,
  },
  DONUT_DEVOTEE: {
    slug: "donut-devotee",
    name: "Donut Devotee",
    description: "Caught 20 donuts in a single game of Donut Catch",
    icon: "🍩",
    category: "SPECIAL" as AchievementCategory,
  },
  NYE_RUN_2025_PARTICIPANT: {
    slug: "nye-run-2025-participant",
    name: "NYE Run 2025",
    description:
      "Participated in Phish's legendary NYE Run 2025 (Dec 28 - Jan 1)",
    icon: "🎆",
    category: "PARTICIPATION" as AchievementCategory,
    metadata: {
      tourDates: "Dec 28, 2024 - Jan 1, 2025",
      venue: "Madison Square Garden",
    },
  },
  ICCULUS: {
    slug: "icculus",
    name: "Helping Friendly Book",
    description: "You summoned Icculus by signing up for notifications",
    icon: "Book",
    category: "PARTICIPATION" as AchievementCategory,
  },
  STREAK_5: {
    slug: "streak-5",
    name: "Couch Tour",
    description: "Submitted picks for 5 shows in a row",
    icon: "🛋️",
    category: "MILESTONE" as AchievementCategory,
    metadata: { streakLength: 5 },
  },
  STREAK_10: {
    slug: "streak-10",
    name: "Tour Rat",
    description: "Submitted picks for 10 shows in a row",
    icon: "🚐",
    category: "MILESTONE" as AchievementCategory,
    metadata: { streakLength: 10 },
  },
  STREAK_25: {
    slug: "streak-25",
    name: "Lot Lifer",
    description: "Submitted picks for 25 shows in a row",
    icon: "🎪",
    category: "MILESTONE" as AchievementCategory,
    metadata: { streakLength: 25 },
  },
  STREAK_50: {
    slug: "streak-50",
    name: "Never Miss a Sunday Show",
    description: "Submitted picks for 50 shows in a row",
    icon: "🌞",
    category: "MILESTONE" as AchievementCategory,
    metadata: { streakLength: 50 },
  },
  // Future achievement examples:
  // SUMMER_TOUR_2025_CHAMPION: {
  //   slug: "summer-tour-2025-champion",
  //   name: "Summer Tour 2025 Champion",
  //   description: "1st place in Summer Tour 2025",
  //   icon: "🥇",
  //   category: "RANKING" as AchievementCategory,
  // },
  // SUMMER_TOUR_2025_SILVER: {
  //   slug: "summer-tour-2025-silver",
  //   name: "Summer Tour 2025 Runner-Up",
  //   description: "2nd place in Summer Tour 2025",
  //   icon: "🥈",
  //   category: "RANKING" as AchievementCategory,
  // },
  // PERFECT_PICKER: {
  //   slug: "perfect-picker",
  //   name: "Perfect Picker",
  //   description: "Got all 13 picks correct in a single show",
  //   icon: "💯",
  //   category: "MILESTONE" as AchievementCategory,
  // },
} as const

export type AchievementSlug = keyof typeof ACHIEVEMENT_DEFINITIONS

// Show-streak milestones, smallest first. Awarded from a user's best streak,
// so a broken streak never takes a milestone away.
export const STREAK_ACHIEVEMENTS = [
  "STREAK_5",
  "STREAK_10",
  "STREAK_25",
  "STREAK_50",
] as const satisfies readonly AchievementSlug[]

export type StreakAchievementSlug = (typeof STREAK_ACHIEVEMENTS)[number]

/** Streak milestones a user with the given best streak has earned. */
export function earnedStreakAchievements(
  bestStreak: number
): StreakAchievementSlug[] {
  return STREAK_ACHIEVEMENTS.filter(
    (key) => bestStreak >= ACHIEVEMENT_DEFINITIONS[key].metadata.streakLength
  )
}
