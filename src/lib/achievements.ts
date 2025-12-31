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
