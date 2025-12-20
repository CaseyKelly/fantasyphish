import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { getSetlist } from "@/lib/phishnet"
import { scoreSubmission } from "@/lib/scoring"
import { format } from "date-fns"

export async function POST() {
  try {
    // Check admin auth
    const session = await auth()
    if (!session?.user?.id || !session.user.isAdmin) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // Get all songs for random selection
    const songs = await prisma.song.findMany({
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    })

    if (songs.length < 13) {
      return NextResponse.json(
        {
          error: "Need at least 13 songs in database to create test submission",
        },
        { status: 400 }
      )
    }

    // Find a random existing show from the database that we can use for testing
    let attempts = 0
    let testShow = null

    console.log(`[Admin] Starting search using existing shows from database`)

    while (!testShow && attempts < 10) {
      // Get completed shows from the database (excluding test shows)
      const existingShows = await prisma.show.findMany({
        where: {
          venue: {
            not: {
              contains: "Test Venue",
            },
          },
          // Look for completed shows (shows that have already happened)
          isComplete: true,
        },
        select: {
          id: true,
          showDate: true,
          venue: true,
          city: true,
          state: true,
        },
        orderBy: { showDate: "desc" },
        take: 100, // Get more shows to increase chances of finding good data
      })

      console.log(
        `[Admin] Found ${existingShows.length} completed shows in database`
      )
      if (existingShows.length > 0) {
        console.log(
          `[Admin] Sample shows:`,
          existingShows.slice(0, 3).map((s) => ({
            date: format(s.showDate, "yyyy-MM-dd"),
            venue: s.venue,
            city: s.city,
          }))
        )
      }

      if (existingShows.length === 0) {
        return NextResponse.json(
          {
            error:
              "No completed shows found in database to use for testing. Run sync script to update show completion status.",
          },
          { status: 400 }
        )
      }

      // Pick a random show from the available shows
      const randomShow =
        existingShows[Math.floor(Math.random() * existingShows.length)]

      // Use UTC date to avoid timezone shifting
      const dateString = randomShow.showDate.toISOString().split("T")[0] // Gets YYYY-MM-DD in UTC

      console.log(
        `[Admin] Attempt ${attempts + 1}: Checking show ${dateString} (${randomShow.venue})`
      )
      console.log(
        `[Admin] Debug - Original showDate object:`,
        randomShow.showDate
      )
      console.log(`[Admin] Debug - Type:`, typeof randomShow.showDate)
      console.log(
        `[Admin] Debug - UTC ISO string:`,
        randomShow.showDate.toISOString()
      )
      console.log(
        `[Admin] Debug - Extracted date string for phish.net API:`,
        dateString
      )

      try {
        // Verify this show has setlist data in phish.net
        const setlist = await getSetlist(dateString)
        console.log(
          `[Admin] Checking ${dateString}:`,
          setlist ? `Found setlist object` : "No setlist found"
        )

        if (setlist) {
          console.log(
            `[Admin] Setlist metadata - showdate: ${setlist.showdate}, venue: ${setlist.venue}`
          )
          console.log(
            `[Admin] Setlist songs array:`,
            setlist.songs ? `${setlist.songs.length} songs` : "No songs array"
          )
          if (setlist.songs) {
            console.log(
              `[Admin] First song:`,
              setlist.songs[0]?.song || "No first song"
            )
          }
          // Check for date mismatch
          if (setlist.showdate !== dateString) {
            console.warn(
              `[Admin] DATE MISMATCH! Requested ${dateString} but got setlist for ${setlist.showdate}`
            )
          }
        }

        if (setlist && setlist.songs && setlist.songs.length >= 10) {
          // Use the existing real show for this date
          testShow = await prisma.show.upsert({
            where: { showDate: new Date(dateString + "T00:00:00.000Z") },
            update: {},
            create: {
              showDate: new Date(dateString + "T00:00:00.000Z"),
              venue: `Test Venue (${randomShow.venue} - ${dateString})`,
              city: randomShow.city || "Test City",
              state: "TEST",
              country: "US",
              timezone: "America/New_York",
              lockTime: new Date(
                randomShow.showDate.getTime() + 7 * 60 * 60 * 1000
              ), // 7 PM
              isComplete: true, // Test shows are complete since they're based on past shows
            },
          })
          console.log(
            `[Admin] Created test show based on ${randomShow.venue} (dateString: ${dateString}, actual DB date: ${testShow.showDate.toISOString()})`
          )
          break
        }
      } catch (error) {
        console.warn(`[Admin] Error checking ${dateString}:`, error)
      }

      attempts++
    }

    if (!testShow) {
      return NextResponse.json(
        {
          error:
            "Could not find a suitable show with setlist data after checking existing shows",
        },
        { status: 400 }
      )
    }

    // Check if test submission already exists
    const existingSubmission = await prisma.submission.findFirst({
      where: {
        showId: testShow.id,
        userId: session.user.id,
      },
    })

    if (existingSubmission) {
      return NextResponse.json(
        {
          error: "Test submission already exists for this show",
          showId: testShow.id,
        },
        { status: 400 }
      )
    }

    // Randomly select songs for picks
    const shuffledSongs = [...songs].sort(() => Math.random() - 0.5)

    const openerSong = shuffledSongs[0]
    const encoreSong = shuffledSongs[1]
    const regularSongs = shuffledSongs.slice(2, 13) // 11 regular songs

    // Create test submission (initially unscored)
    const submission = await prisma.submission.create({
      data: {
        userId: session.user.id,
        showId: testShow.id,
        isScored: false,
        picks: {
          create: [
            {
              songId: openerSong.id,
              pickType: "OPENER",
            },
            {
              songId: encoreSong.id,
              pickType: "ENCORE",
            },
            ...regularSongs.map((song) => ({
              songId: song.id,
              pickType: "REGULAR" as const,
            })),
          ],
        },
      },
      include: {
        picks: {
          include: { song: true },
        },
      },
    })

    console.log(
      `[Admin] Created test submission for ${testShow.venue} (UTC: ${testShow.showDate.toISOString().split("T")[0]})`
    )

    // Now score the submission immediately since it's a test submission
    try {
      const dateString = testShow.showDate.toISOString().split("T")[0]
      console.log(
        `[Admin] Fetching setlist for scoring - testShow.showDate: ${testShow.showDate.toISOString()}, dateString: ${dateString}`
      )
      const setlist = await getSetlist(dateString)

      if (setlist && setlist.songs) {
        console.log(
          `[Admin] Scoring test submission with ${setlist.songs.length} songs from setlist`
        )
        console.log(
          `[Admin] Setlist date verification - requested: ${dateString}, received: ${setlist.showdate}`
        )
        if (setlist.showdate !== dateString) {
          console.error(
            `[Admin] ERROR: Date mismatch when scoring! Test show date is ${dateString} but setlist is for ${setlist.showdate}`
          )
        }

        // Score the submission
        const { scoredPicks, totalPoints } = scoreSubmission(
          submission.picks,
          setlist
        )

        // Save the setlist data to the show for display
        await prisma.show.update({
          where: { id: testShow.id },
          data: {
            setlistJson: setlist as unknown as object,
            fetchedAt: new Date(),
            lastScoredAt: new Date(),
          },
        })

        // Update each pick with scoring results
        for (const scoredPick of scoredPicks) {
          await prisma.pick.update({
            where: { id: scoredPick.id },
            data: {
              wasPlayed: scoredPick.wasPlayed,
              pointsEarned: scoredPick.pointsEarned,
            },
          })
        }

        // Update submission with total score
        await prisma.submission.update({
          where: { id: submission.id },
          data: {
            isScored: true,
            totalPoints: totalPoints,
          },
        })

        console.log(`[Admin] Test submission scored: ${totalPoints} points`)
      } else {
        console.warn(
          `[Admin] Could not fetch setlist for scoring test submission`
        )
      }
    } catch (scoringError) {
      console.error(`[Admin] Error scoring test submission:`, scoringError)
      // Continue without scoring - the submission exists but isn't scored
    }

    return NextResponse.json({
      success: true,
      message: `Test submission created for ${format(testShow.showDate, "yyyy-MM-dd")}`,
      testShow: {
        id: testShow.id,
        showDate: format(testShow.showDate, "yyyy-MM-dd"),
        venue: testShow.venue,
      },
      submission: {
        id: submission.id,
        picks: submission.picks.map((pick) => ({
          song: pick.song.name,
          pickType: pick.pickType,
        })),
      },
    })
  } catch (error) {
    console.error("[Admin] Test submission creation error:", error)
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Test submission creation failed",
      },
      { status: 500 }
    )
  }
}
