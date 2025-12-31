import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { ACHIEVEMENT_DEFINITIONS } from "@/lib/achievements"

// Force dynamic rendering and disable caching
export const dynamic = "force-dynamic"
export const runtime = "nodejs"

// This endpoint is called by the daily cron job as a backup/safety net
// Primary achievement awarding happens inline during scoring (every minute)
// This cron catches any achievements that may have been missed
export async function POST(request: Request) {
  const startTime = Date.now()
  console.log(
    `[AwardAchievements:POST] ========================================`
  )
  console.log(
    `[AwardAchievements:POST] Daily backup cron started at ${new Date().toISOString()}`
  )

  try {
    // Verify cron secret (optional to configure, but enforced when CRON_SECRET is set)
    // Vercel cron jobs send "Vercel-Cron" as user-agent and are allowed without CRON_SECRET
    // Manual triggers require the correct CRON_SECRET when it is configured
    const authHeader = request.headers.get("authorization")
    const userAgent = request.headers.get("user-agent")
    const token = authHeader?.replace("Bearer ", "")
    const cronSecret = process.env.CRON_SECRET
    const isVercelCron = userAgent === "Vercel-Cron"

    console.log(
      `[AwardAchievements:POST] Auth check: cronSecret=${cronSecret ? "SET" : "NOT_SET"}, authHeader=${authHeader ? "PROVIDED" : "MISSING"}, isVercelCron=${isVercelCron}`
    )

    // Allow requests from:
    // 1. Vercel cron (user-agent: "Vercel-Cron")
    // 2. Manual triggers with correct CRON_SECRET
    if (!isVercelCron && cronSecret && token !== cronSecret) {
      console.error(
        "[AwardAchievements:POST] Unauthorized: not Vercel cron and invalid/missing CRON_SECRET"
      )
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    console.log("[AwardAchievements:POST] Authorization successful")

    const results = []

    // Award PERFECT_OPENER achievement
    const openerResults = await awardAchievement("PERFECT_OPENER", "OPENER")
    results.push(openerResults)

    // Award PERFECT_CLOSER achievement
    const closerResults = await awardAchievement("PERFECT_CLOSER", "ENCORE")
    results.push(closerResults)

    const duration = Date.now() - startTime
    console.log(`[AwardAchievements:POST] ✓ Complete in ${duration}ms`)
    console.log(
      `[AwardAchievements:POST] Summary: ${results.reduce((sum, r) => sum + r.awarded, 0)} total awarded, ${results.reduce((sum, r) => sum + r.skipped, 0)} total skipped`
    )
    console.log(
      `[AwardAchievements:POST] ========================================`
    )

    return NextResponse.json({
      success: true,
      duration: `${duration}ms`,
      results,
    })
  } catch (error) {
    const duration = Date.now() - startTime
    console.error(
      "[AwardAchievements:POST] ✗ Error awarding achievements:",
      error
    )
    console.error("[AwardAchievements:POST] ✗ Error details:", {
      message: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    })
    console.log(
      `[AwardAchievements:POST] ========================================`
    )
    return NextResponse.json(
      {
        error: "Failed to award achievements",
        details: error instanceof Error ? error.message : String(error),
        duration: `${duration}ms`,
      },
      { status: 500 }
    )
  } finally {
    await prisma.$disconnect()
  }
}

async function awardAchievement(
  achievementSlug: "PERFECT_OPENER" | "PERFECT_CLOSER",
  pickType: "OPENER" | "ENCORE"
) {
  const achievementDef = ACHIEVEMENT_DEFINITIONS[achievementSlug]
  const pickTypeName = pickType === "OPENER" ? "opener" : "encore"

  console.log(
    `[AwardAchievements:POST] ${achievementDef.icon} Awarding ${achievementDef.name} achievements...`
  )

  // 1. Create or update the achievement record
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

  console.log(
    `[AwardAchievements:POST] ✓ Achievement record ready: ${achievement.name}`
  )

  // 2. Find all picks where user correctly guessed the opener/encore
  const correctPicks = await prisma.pick.findMany({
    where: {
      pickType: pickType,
      wasPlayed: true,
    },
    include: {
      submission: {
        include: {
          show: true,
          user: {
            select: {
              id: true,
              username: true,
            },
          },
        },
      },
      song: {
        select: {
          name: true,
        },
      },
    },
  })

  console.log(
    `[AwardAchievements:POST] Found ${correctPicks.length} correct ${pickTypeName} picks`
  )

  if (correctPicks.length === 0) {
    console.log(
      `[AwardAchievements:POST] No correct ${pickTypeName} picks found`
    )
    return {
      achievement: achievementDef.name,
      awarded: 0,
      skipped: 0,
    }
  }

  // 3. Get unique users who made correct picks
  const userPicksMap = new Map<string, (typeof correctPicks)[0]>()

  for (const pick of correctPicks) {
    const userId = pick.submission.user.id
    // Store the first correct pick for each user (for metadata)
    if (!userPicksMap.has(userId)) {
      userPicksMap.set(userId, pick)
    }
  }

  console.log(
    `[AwardAchievements:POST] Found ${userPicksMap.size} unique users with correct ${pickTypeName} picks`
  )

  // 4. Award achievement to each user (skip if already awarded)
  let awarded = 0
  let skipped = 0

  for (const [userId, pick] of userPicksMap.entries()) {
    try {
      await prisma.userAchievement.create({
        data: {
          userId: userId,
          achievementId: achievement.id,
          metadata: {
            firstCorrectShow: pick.submission.show.showDate.toISOString(),
            venue: pick.submission.show.venue,
            songName: pick.song.name,
          },
        },
      })
      awarded++
      console.log(
        `[AwardAchievements:POST]   ✓ Awarded to ${pick.submission.user.username}`
      )
    } catch (error: unknown) {
      // User already has this achievement (unique constraint violation)
      if (
        error &&
        typeof error === "object" &&
        "code" in error &&
        error.code === "P2002"
      ) {
        skipped++
      } else {
        console.error(
          `[AwardAchievements:POST] Error awarding achievement to user ${pick.submission.user.username}:`,
          error
        )
      }
    }
  }

  return {
    achievement: achievementDef.name,
    awarded,
    skipped,
    total: awarded + skipped,
  }
}

// GET endpoint - Vercel cron jobs use GET requests
// This is the main entry point for the cron job
export async function GET(request: Request) {
  // Vercel cron makes GET requests, so we handle awarding here
  // Just delegate to POST handler
  return POST(request)
}
