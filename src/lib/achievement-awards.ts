import { prisma } from "@/lib/prisma"
import { ACHIEVEMENT_DEFINITIONS } from "@/lib/achievements"
import { PickType } from "@prisma/client"

/**
 * Award opener or closer achievement to a user
 * This is idempotent - safe to call multiple times
 */
export async function awardPickAchievement(
  userId: string,
  pickType: "OPENER" | "ENCORE",
  metadata?: {
    showDate?: Date
    venue?: string
    songName?: string
  }
): Promise<{ awarded: boolean; error?: string }> {
  try {
    // Determine which achievement to award
    const achievementSlug =
      pickType === "OPENER" ? "PERFECT_OPENER" : "PERFECT_CLOSER"
    const achievementDef = ACHIEVEMENT_DEFINITIONS[achievementSlug]

    // 1. Get or create the achievement record
    const achievement = await prisma.achievement.upsert({
      where: { slug: achievementDef.slug },
      update: {
        name: achievementDef.name,
        description: achievementDef.description,
        icon: achievementDef.icon,
        category: achievementDef.category,
      },
      create: {
        slug: achievementDef.slug,
        name: achievementDef.name,
        description: achievementDef.description,
        icon: achievementDef.icon,
        category: achievementDef.category,
      },
    })

    // 2. Check if user already has this achievement
    const existing = await prisma.userAchievement.findUnique({
      where: {
        userId_achievementId: {
          userId,
          achievementId: achievement.id,
        },
      },
    })

    if (existing) {
      // User already has this achievement
      return { awarded: false }
    }

    // 3. Award the achievement
    await prisma.userAchievement.create({
      data: {
        userId,
        achievementId: achievement.id,
        metadata: metadata || {},
      },
    })

    return { awarded: true }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error)
    console.error(
      `[AwardPickAchievement] Error awarding ${pickType} achievement:`,
      errorMessage
    )
    return { awarded: false, error: errorMessage }
  }
}

/**
 * Process achievement awards for picks that were just scored
 * Call this after updating picks in the scoring endpoint
 */
export async function processPickAchievements(
  scoredPicks: Array<{
    id: string
    wasPlayed: boolean | null
    previousWasPlayed?: boolean | null
  }>,
  submission: {
    userId: string
    show: {
      showDate: Date
      venue: string
    }
    picks: Array<{
      id: string
      pickType: PickType
      song: {
        name: string
      }
    }>
  }
): Promise<{
  awarded: number
  errors: number
}> {
  let awarded = 0
  let errors = 0

  for (const scoredPick of scoredPicks) {
    // Only award if pick just became correct (changed from null/false to true)
    if (
      scoredPick.wasPlayed === true &&
      scoredPick.previousWasPlayed !== true
    ) {
      // Find the full pick details
      const pick = submission.picks.find((p) => p.id === scoredPick.id)

      if (pick && (pick.pickType === "OPENER" || pick.pickType === "ENCORE")) {
        const result = await awardPickAchievement(
          submission.userId,
          pick.pickType,
          {
            showDate: submission.show.showDate,
            venue: submission.show.venue,
            songName: pick.song.name,
          }
        )

        if (result.awarded) {
          awarded++
          console.log(
            `[ProcessPickAchievements] ✓ Awarded ${pick.pickType} achievement to user ${submission.userId}`
          )
        } else if (result.error) {
          errors++
          console.error(
            `[ProcessPickAchievements] ✗ Failed to award ${pick.pickType} achievement:`,
            result.error
          )
        }
        // If result.awarded is false but no error, user already has achievement (not an error)
      }
    }
  }

  return { awarded, errors }
}

/**
 * Award a tour placement achievement to a user
 * This is idempotent - safe to call multiple times
 */
export async function awardTourPlacementAchievement(
  userId: string,
  tourId: string,
  tourName: string,
  placement: 1 | 2 | 3,
  metadata?: {
    totalPoints?: number
    showsPlayed?: number
  }
): Promise<{ awarded: boolean; error?: string }> {
  try {
    // Generate unique slug for this tour placement
    const slug = `${tourName
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(
        /^-|-$/g,
        ""
      )}-${placement === 1 ? "champion" : placement === 2 ? "runner-up" : "third-place"}`

    // Define achievement properties based on placement
    const placementData = {
      1: {
        name: `${tourName} Champion`,
        description: `1st place in ${tourName}`,
        icon: "🥇",
      },
      2: {
        name: `${tourName} Runner-Up`,
        description: `2nd place in ${tourName}`,
        icon: "🥈",
      },
      3: {
        name: `${tourName} Third Place`,
        description: `3rd place in ${tourName}`,
        icon: "🥉",
      },
    }

    const achievementData = placementData[placement]

    // 1. Get or create the achievement record
    const achievement = await prisma.achievement.upsert({
      where: { slug },
      update: {
        name: achievementData.name,
        description: achievementData.description,
        icon: achievementData.icon,
        category: "RANKING",
        metadata: {
          tourId,
          tourName,
          placement,
        },
      },
      create: {
        slug,
        name: achievementData.name,
        description: achievementData.description,
        icon: achievementData.icon,
        category: "RANKING",
        metadata: {
          tourId,
          tourName,
          placement,
        },
      },
    })

    // 2. Check if user already has this achievement
    const existing = await prisma.userAchievement.findUnique({
      where: {
        userId_achievementId: {
          userId,
          achievementId: achievement.id,
        },
      },
    })

    if (existing) {
      // User already has this achievement
      return { awarded: false }
    }

    // 3. Award the achievement
    await prisma.userAchievement.create({
      data: {
        userId,
        achievementId: achievement.id,
        metadata: metadata || {},
      },
    })

    return { awarded: true }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error)
    console.error(
      `[AwardTourPlacementAchievement] Error awarding placement ${placement} achievement:`,
      errorMessage
    )
    return { awarded: false, error: errorMessage }
  }
}
