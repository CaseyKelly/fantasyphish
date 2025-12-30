# Cron Jobs Configuration

This document describes the automated cron jobs that keep FantasyPhish's data up-to-date.

## Overview

FantasyPhish uses three Vercel cron jobs to automate scoring, tour synchronization, and song statistics:

1. **Scoring Cron** - Runs every minute to score shows progressively
2. **Tour Sync Cron** - Runs daily at 6 AM UTC to sync tour and show data
3. **Song Stats Sync Cron** - Runs daily at 7 AM UTC (midnight MT) to sync song gap data

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
   - Marks show complete if encore appears

3. Logs every step for troubleshooting

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
   - Creates or updates tour information
   - Sets venue timezone based on state/province
   - Calculates 7 PM lock time in venue timezone
   - Updates show details (venue, city, etc.)

3. Ensures New Year's Eve shows are ready before the year rolls over

### Response Example

```json
{
  "success": true,
  "duration": "5030ms",
  "years": [
    {
      "year": 2025,
      "tours": 6,
      "shows": 48
    },
    {
      "year": 2026,
      "tours": 2,
      "shows": 13
    }
  ],
  "totalTours": 8,
  "totalShows": 61
}
```

### Logging

```
[Sync Tours] Cron job started at 2025-12-19T06:00:00.000Z
[Sync Tours] Authorization successful
[Sync Tours] Syncing years: 2025, 2026
[Sync Tours] Starting sync for year 2025
[Sync Tours] Fetching shows for year 2025...
[Sync Tours] Fetched 111 total shows
[Sync Tours] Filtered to 48 Phish shows
[Sync Tours] Found 6 tours
[Sync Tours] Tour: 2025 Spring Tour (8 shows)
[Sync Tours] Tour: 2025 Summer Tour (23 shows)
[Sync Tours] Starting sync for year 2026
[Sync Tours] Fetching shows for year 2026...
[Sync Tours] Fetched 13 total shows
[Sync Tours] Filtered to 13 Phish shows
[Sync Tours] Found 2 tours
[Sync Tours] Tour: 2026 Mexico (4 shows)
[Sync Tours] Tour: 2026 Sphere (9 shows)
[Sync Tours] ✓ Sync complete in 5030ms
[Sync Tours] Summary: 61 shows across 8 tours
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
