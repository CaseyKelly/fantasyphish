# Cron Jobs Configuration

This document describes the automated cron jobs that keep FantasyPhish's data up-to-date.

## Overview

FantasyPhish uses four Vercel cron jobs to automate scoring, tour synchronization, song statistics, and achievements:

1. **Scoring Cron** - Runs every minute to score shows progressively
2. **Tour Sync Cron** - Runs daily at 6 AM UTC to sync tour and show data
3. **Song Stats Sync Cron** - Runs daily at 7 AM UTC (midnight MT) to sync song gap data
4. **Award Achievements Cron** - Runs daily at 8 AM UTC as a backup to catch missed achievements

## Configuration

Both cron jobs are configured in `vercel.json`:

```json
{
  "crons": [
    {
      "path": "/api/score",
      "schedule": "* * * * *"
    },
    {
      "path": "/api/sync-tours",
      "schedule": "0 6 * * *"
    },
    {
      "path": "/api/sync-song-stats",
      "schedule": "0 7 * * *"
    },
    {
      "path": "/api/award-achievements",
      "schedule": "0 8 * * *"
    }
  ]
}
```

## Security

Both endpoints require authentication via the `CRON_SECRET` environment variable:

```bash
Authorization: Bearer <CRON_SECRET>
```

**Setup:**

1. Set `CRON_SECRET` in Vercel: Settings → Environment Variables
2. Use a secure random string (e.g., 64 hex characters)
3. Add to all environments (Production, Preview, Development)

## 1. Scoring Cron (`/api/score`)

### Schedule

- **Frequency:** Every 5 minutes
- **Pattern:** `*/5 * * * *`
- **Runs:** 288 times per day

### What It Does

1. Finds all shows that are:
   - Locked (lockTime <= now)
   - Not complete (isComplete = false)
   - Have submissions

2. For each show:
   - Fetches current setlist from Phish.net API
   - Compares with previous song count
   - Updates scores if new songs detected
   - Marks show complete 30 minutes after the last encore song appears
   - Resets the 30-minute timer if additional encore songs are added

3. Logs every step for troubleshooting

### Encore Grace Period

The scoring system implements a 30-minute grace period after encore songs appear:

- **Initial Detection:** When the first encore song is detected, a 30-minute timer starts
- **Timer Reset:** If additional encore songs are added (2nd encore, 3rd encore, etc.), the timer resets to 30 minutes
- **Show Complete:** The show is marked complete only after 30 minutes have passed without any new encore songs
- **Progressive Scoring:** Scores continue to update during the grace period as new songs are added

This ensures that multi-song encores and late additions are properly captured before finalizing scores.

### Response Example

```json
{
  "success": true,
  "duration": "1195ms",
  "results": {
    "progressiveShows": [
      {
        "showId": "abc123",
        "showDate": "2025-12-31",
        "status": "in_progress",
        "songCount": 12,
        "submissionsUpdated": 5
      }
    ],
    "completeShows": [
      {
        "showId": "def456",
        "showDate": "2025-12-30",
        "status": "completed",
        "songCount": 28,
        "submissionsScored": 8
      }
    ]
  }
}
```

### Logging

The cron outputs detailed logs to help troubleshoot issues:

```
[Score] Cron job started at 2025-12-19T10:00:00.000Z
[Score] Authorization successful
[Score] Found 3 shows to check
[Score] Processing show 2025-12-31 (Madison Square Garden)
[Score]   ✓ Fetched setlist with 12 songs
[Score]   Encore detected: true
[Score]   Current encore count: 2, Previous: 1
[Score]   ✓ New encore song(s) added (1 → 2) - resetting 30-minute timer
[Score]   Show complete: false
[Score]   Updating submission abc123: 10 → 12 songs, 8 points
[Score]   ✓ Show updated (5/8 submissions had changes)
[Score] ✓ Complete in 1195ms
[Score] Summary: 2 progressive, 1 completed
```

### Manual Testing

```bash
curl -X POST http://localhost:3000/api/score \
  -H "Authorization: Bearer YOUR_CRON_SECRET"
```

## 2. Tour Sync Cron (`/api/sync-tours`)

### Schedule

- **Frequency:** Daily at 6 AM UTC
- **Pattern:** `0 6 * * *`
- **Runs:** Once per day (1 AM EST / 11 PM PST)

### What It Does

1. Fetches shows from Phish.net API for:
   - Current year
   - Next year

2. For each show:
   - Creates or updates tour information (only if data changed)
   - Sets venue timezone based on state/province
   - Calculates 7 PM lock time in venue timezone
   - Updates show details (venue, city, etc.)
   - **Skips updating shows that have already been scored (isComplete = true)** to preserve setlist data

3. Ensures New Year's Eve shows are ready before the year rolls over

### Idempotency

The sync-tours cron is fully idempotent:

- Tours are only updated if name or dates have changed
- Shows are only updated if venue, location, or timezone data has changed
- Shows that have already been scored (isComplete = true) are never updated
- Detailed logging shows which records were created, updated, or skipped

### Response Example

```json
{
  "success": true,
  "duration": "5030ms",
  "years": [
    {
      "year": 2025,
      "tours": 6,
      "shows": 48,
      "toursCreated": 0,
      "toursUpdated": 1,
      "showsCreated": 2,
      "showsUpdated": 3,
      "showsSkipped": 38,
      "showsSkippedComplete": 5
    },
    {
      "year": 2026,
      "tours": 2,
      "shows": 13,
      "toursCreated": 0,
      "toursUpdated": 0,
      "showsCreated": 0,
      "showsUpdated": 0,
      "showsSkipped": 13,
      "showsSkippedComplete": 0
    }
  ],
  "totalTours": 8,
  "totalShows": 61,
  "totalToursCreated": 0,
  "totalToursUpdated": 1,
  "totalShowsCreated": 2,
  "totalShowsUpdated": 3,
  "totalShowsSkipped": 51,
  "totalShowsSkippedComplete": 5
}
```

### Logging

```
[Sync Tours] Cron job started at 2025-12-31T06:00:00.000Z
[Sync Tours] Authorization successful
[Sync Tours] Syncing years: 2025, 2026
[Sync Tours] Starting sync for year 2025
[Sync Tours] Fetching shows for year 2025...
[Sync Tours] Fetched 111 total shows
[Sync Tours] Filtered to 48 Phish shows
[Sync Tours] Found 6 tours
[Sync Tours]   → Skipped tour (unchanged): 2025 Spring Tour
[Sync Tours]   ✓ Updated tour: 2025 Summer Tour
[Sync Tours]   → Skipped tour (unchanged): 2025 Fall Tour
[Sync Tours] Year 2025 summary: 0 tours created, 1 tours updated, 2 shows created, 3 shows updated, 38 shows skipped (unchanged), 5 shows skipped (already scored)
[Sync Tours] Starting sync for year 2026
[Sync Tours] Fetching shows for year 2026...
[Sync Tours] Fetched 13 total shows
[Sync Tours] Filtered to 13 Phish shows
[Sync Tours] Found 2 tours
[Sync Tours]   → Skipped tour (unchanged): 2026 Mexico
[Sync Tours]   → Skipped tour (unchanged): 2026 Sphere
[Sync Tours] Year 2026 summary: 0 tours created, 0 tours updated, 0 shows created, 0 shows updated, 13 shows skipped (unchanged), 0 shows skipped (already scored)
[Sync Tours] ✓ Sync complete in 5030ms
[Sync Tours] Summary: 61 shows across 8 tours (2 created, 3 updated, 51 skipped unchanged, 5 skipped already scored)
```

### Manual Testing

```bash
# Test API endpoint
curl -X POST http://localhost:3000/api/sync-tours \
  -H "Authorization: Bearer YOUR_CRON_SECRET"

# Test standalone script (syncs current + next year)
npx tsx scripts/sync-tours.ts

# Test standalone script (specific year)
npx tsx scripts/sync-tours.ts 2024
```

## 3. Song Stats Sync Cron (`/api/sync-song-stats`)

### Schedule

- **Frequency:** Daily at 7 AM UTC
- **Pattern:** `0 7 * * *`
- **Runs:** Once per day (midnight MT / 2 AM EST / 11 PM PST)

### What It Does

1. Fetches all songs from Phish.net API `/v5/songs`

2. For each song:
   - Updates `timesPlayed` (total performances)
   - Updates `gap` (shows since last played)
   - Updates `lastPlayed` (date of last performance)

3. Enables "played X shows ago" display in song picker

### Response Example

```json
{
  "success": true,
  "updated": 857,
  "errors": 0,
  "total": 857,
  "duration": "3245ms"
}
```

### Logging

```
[Sync Song Stats] Cron job started at 2025-12-29T07:00:00.000Z
[Sync Song Stats] Authorization successful
[Sync Song Stats] Fetching songs from phish.net API...
[Sync Song Stats] Fetched 857 songs from phish.net
[Sync Song Stats] ✓ Sync complete in 3245ms: 857 updated, 0 errors
```

### Manual Testing

```bash
# Test API endpoint
curl -X POST http://localhost:3000/api/sync-song-stats \
  -H "Authorization: Bearer YOUR_CRON_SECRET"

# Test standalone script
npx tsx scripts/sync-song-stats.ts
```

## 4. Award Achievements Cron (`/api/award-achievements`)

### Schedule

- **Frequency:** Daily at 8 AM UTC
- **Pattern:** `0 8 * * *`
- **Runs:** Once per day (3 AM EST / 12 AM PST)

### What It Does

This cron serves as a **backup/safety net** for achievement awarding. The primary achievement awarding happens inline during the scoring cron (every minute). This daily cron catches any achievements that may have been missed.

1. Awards **PERFECT_OPENER** achievement to users who correctly guessed an opener
2. Awards **PERFECT_CLOSER** achievement to users who correctly guessed an encore

3. For each achievement type:
   - Finds all picks where the user correctly guessed the opener/encore (pickType matches and wasPlayed = true)
   - Awards the achievement to qualifying users
   - Skips users who already have the achievement (idempotent)
   - Stores metadata with the first correct show date, venue, and song name

### Response Example

```json
{
  "success": true,
  "duration": "1234ms",
  "results": [
    {
      "achievement": "Perfect Opener",
      "awarded": 5,
      "skipped": 142,
      "total": 147
    },
    {
      "achievement": "Perfect Closer",
      "awarded": 3,
      "skipped": 98,
      "total": 101
    }
  ]
}
```

### Logging

```
[AwardAchievements:POST] ========================================
[AwardAchievements:POST] Daily backup cron started at 2025-12-31T08:00:00.000Z
[AwardAchievements:POST] Auth check: cronSecret=SET, authHeader=MISSING, isVercelCron=true
[AwardAchievements:POST] Authorization successful
[AwardAchievements:POST] 🎯 Awarding Perfect Opener achievements...
[AwardAchievements:POST] ✓ Achievement record ready: Perfect Opener
[AwardAchievements:POST] Found 147 correct opener picks
[AwardAchievements:POST] Found 147 unique users with correct opener picks
[AwardAchievements:POST]   ✓ Awarded to johndoe
[AwardAchievements:POST]   ✓ Awarded to janedoe
[AwardAchievements:POST] 🎵 Awarding Perfect Closer achievements...
[AwardAchievements:POST] ✓ Achievement record ready: Perfect Closer
[AwardAchievements:POST] Found 101 correct encore picks
[AwardAchievements:POST] Found 101 unique users with correct encore picks
[AwardAchievements:POST]   ✓ Awarded to johndoe
[AwardAchievements:POST] ✓ Complete in 1234ms
[AwardAchievements:POST] Summary: 8 total awarded, 240 total skipped
[AwardAchievements:POST] ========================================
```

### Manual Testing

```bash
# Test API endpoint
curl -X POST http://localhost:3000/api/award-achievements \
  -H "Authorization: Bearer YOUR_CRON_SECRET"

# Or just trigger via GET (Vercel cron style)
curl http://localhost:3000/api/award-achievements \
  -H "Authorization: Bearer YOUR_CRON_SECRET"
```

### Notes

- This is a **backup** cron - primary achievement awarding happens during scoring
- Fully idempotent - safe to run multiple times
- Skips users who already have achievements (P2002 unique constraint)
- Metadata includes firstCorrectShow (ISO date string), venue, and songName

## Monitoring

### Success Indicators

**Scoring Cron:**

- `success: true` in response
- Shows being processed
- Scores updating as songs are added
- Shows marked complete when encores appear

**Tour Sync Cron:**

- `success: true` in response
- Both years synced successfully
- Show counts match expected tours
- Timezones set correctly for US/Canada shows

**Song Stats Sync Cron:**

- `success: true` in response
- Majority of songs updated successfully
- Gap data available in song picker
- Error count is low (songs not in DB yet)

### Error Scenarios

Both crons handle errors gracefully and return:

```json
{
  "success": false,
  "error": "Error message here",
  "duration": "1234ms"
}
```

Common errors:

- **401 Unauthorized**: CRON_SECRET missing or incorrect
- **API errors**: Phish.net API down or rate limited
- **Database errors**: Connection issues or schema problems

### Viewing Logs in Vercel

1. Go to your project dashboard
2. Click **Deployments** → Select deployment
3. Click **Functions** tab
4. Find `/api/score` or `/api/sync-tours`
5. View execution logs with timestamps

## Timezone Reference

Shows lock at **7 PM in the venue's timezone**. Examples:

| Show Location   | Timezone                      | Lock Time (UTC) |
| --------------- | ----------------------------- | --------------- |
| New York, NY    | America/New_York (EST/EDT)    | 00:00 / 23:00   |
| Chicago, IL     | America/Chicago (CST/CDT)     | 01:00 / 00:00   |
| Denver, CO      | America/Denver (MST/MDT)      | 02:00 / 01:00   |
| Los Angeles, CA | America/Los_Angeles (PST/PDT) | 03:00 / 02:00   |
| Cancun, Mexico  | America/New_York\*            | 00:00           |

\*Defaults to Eastern time when state is unknown

## Troubleshooting

### Scoring Not Running

1. Check CRON_SECRET is set in Vercel
2. Verify shows have `lockTime` set (not null)
3. Check if show has submissions
4. Review logs for API errors

### Tours Not Syncing

1. Verify PHISHNET_API_KEY is set
2. Check Phish.net API status
3. Review logs for specific error messages
4. Try manual sync: `npx tsx scripts/sync-tours.ts`

### Song Stats Not Updating

1. Verify PHISHNET_API_KEY is set
2. Check if songs exist in database (run seed script first)
3. Review logs for API errors
4. Try manual sync: `npx tsx scripts/sync-song-stats.ts`

### Gap Info Not Showing in UI

1. Ensure song stats sync has run at least once
2. Check that gap field is not null in database
3. Verify /api/songs includes gap and lastPlayed fields
4. Clear browser cache and reload

### Shows Not Locking at 7 PM

1. Verify show has `timezone` field set
2. Check if sync-tours cron has run
3. Manually update timezone:
   ```sql
   UPDATE "Show" SET timezone = 'America/New_York' WHERE state = 'NY';
   ```

### No Logs Appearing

1. Ensure you're checking the correct environment (Production vs Preview)
2. Wait 5 minutes for scoring cron to run
3. Check if deployment is successful
4. Verify cron configuration in vercel.json

## Development

### Local Testing

Both endpoints work locally with the dev server:

```bash
# Start dev server
npm run dev

# Test scoring (in another terminal)
curl -X POST http://localhost:3000/api/score \
  -H "Authorization: Bearer YOUR_CRON_SECRET"

# Test sync
curl -X POST http://localhost:3000/api/sync-tours \
  -H "Authorization: Bearer YOUR_CRON_SECRET"
```

### Adding More Logging

To add custom logging, use the `[Score]` or `[Sync Tours]` prefix:

```typescript
console.log(`[Score] Custom message here`)
console.error(`[Score] ✗ Error message here`)
```

### Changing Cron Schedules

Edit `vercel.json` and redeploy:

```json
{
  "crons": [
    {
      "path": "/api/score",
      "schedule": "*/10 * * * *" // Every 10 minutes instead of 5
    }
  ]
}
```

Cron syntax: `* * * * *` = minute hour day month weekday

## Cost Considerations

**Vercel Cron Jobs are free** for most use cases:

- Included in all plans (Hobby, Pro, Enterprise)
- No separate billing for cron executions
- Billed as regular function invocations

**Estimated Usage:**

- Scoring: 288 invocations/day × ~1s each = ~5 minutes/day
- Tour Sync: 1 invocation/day × ~5s each = ~5 seconds/day
- **Total:** ~5 minutes/day of function execution time

This is well within Vercel's free tier limits.
