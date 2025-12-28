# Score Cron Monitoring Guide

## What Changed

The `/api/score` endpoint now includes **comprehensive logging** for progressive scoring. Every 5 minutes, the cron will:

1. ✅ Fetch the latest setlist from Phish.net
2. ✅ Log all songs found in the setlist
3. ✅ Update scores progressively as new songs are added
4. ✅ Show which submissions changed and by how much
5. ✅ Track timing for performance monitoring

## Enhanced Logging Features

### Before (Old Logs)

```
Error scoring shows: [error message]
```

### After (New Logs)

```
[Score] Cron job started at 2025-12-28T00:00:00.000Z
[Score] ✓ Authorization successful
[Score] Found 1 show(s) to check
[Score] Processing show 2025-12-28 (Madison Square Garden, New York)
[Score]   API Response: {...full JSON response...}
[Score]   ✓ Fetched setlist with 8 song(s)
[Score]   Songs: Wilson, Axilla, Sample in a Jar, Divided Sky, Split Open and Melt, You Enjoy Myself, Bouncing Around the Room, Character Zero
[Score]   Opener: Wilson
[Score]   Encore: N/A
[Score]   Show complete: false
[Score]   ✓ Updated submission abc123: 0 → 8 songs, 9 points
[Score]   ✓ Updated submission def456: 0 → 8 songs, 11 points
[Score]   ✓ Processed 2 submission(s) (2 updated)
[Score] ✓ Complete in 1245ms
[Score] Summary: 1 in progress, 0 completed
```

## How to Monitor Tomorrow's Show

### Method 1: Vercel Dashboard (Recommended)

1. **Go to Vercel Dashboard**
   - Visit: https://vercel.com/dashboard
   - Select your project (fantasyphish)

2. **View Real-Time Logs**
   - Click **Logs** in the left sidebar
   - Or go to: `https://vercel.com/[your-username]/fantasyphish/logs`

3. **Filter for Score Logs**
   - In the search/filter box, type: `[Score]`
   - Or filter by path: `/api/score`
   - Set time range to "Last hour" or "Live"

4. **What You'll See**
   - Every 5 minutes, new `[Score]` logs will appear
   - You'll see exactly which songs are in the setlist
   - You'll see score updates for each submission
   - You'll see timing information

### Method 2: Vercel CLI (Real-Time Terminal)

```bash
# Install Vercel CLI (if not already installed)
npm i -g vercel

# Login
vercel login

# Watch logs in real-time
vercel logs --follow

# Filter only score logs
vercel logs --follow | grep "\[Score\]"
```

### Method 3: Manual API Check

```bash
# Check which shows are pending scoring
curl https://your-domain.com/api/score

# Manually trigger scoring (requires CRON_SECRET)
curl -X POST https://your-domain.com/api/score \
  -H "Authorization: Bearer YOUR_CRON_SECRET"
```

Response will show detailed scoring results:

```json
{
  "success": true,
  "duration": "1245ms",
  "showsProcessed": 1,
  "results": [
    {
      "showId": "...",
      "showDate": "2025-12-28",
      "status": "in_progress",
      "songCount": 8,
      "submissionsProcessed": 2,
      "submissionsUpdated": 2,
      "setlist": {
        "opener": "Wilson",
        "encoreSongs": [],
        "allSongs": ["Wilson", "Axilla", ...]
      }
    }
  ]
}
```

## Progressive Scoring Timeline

Assuming the show starts at **7 PM** (when picks lock):

| Time      | What Happens            | Expected Logs                               |
| --------- | ----------------------- | ------------------------------------------- |
| 7:00 PM   | Picks lock, show starts | `Found 0 show(s) to check` (no setlist yet) |
| 7:05 PM   | Cron checks             | `No setlist data returned from API`         |
| 7:15 PM   | First songs posted      | `✓ Fetched setlist with 3 song(s)`          |
| 7:20 PM   | More songs added        | `Updated submission: 3 → 5 songs, 6 points` |
| 7:25 PM   | More songs added        | `Updated submission: 5 → 8 songs, 9 points` |
| ...       | Every 5 minutes         | Progressive updates...                      |
| ~10:30 PM | Encore played           | `Show complete: true`, `1 completed`        |

## What to Look For Tomorrow

### ✅ Success Indicators

1. **Cron is running every 5 minutes**
   - Look for timestamps 5 minutes apart
   - `[Score] Cron job started at ...`

2. **Setlist is being fetched**
   - `✓ Fetched setlist with X song(s)`
   - Songs list appears in logs

3. **Scores are updating progressively**
   - `Updated submission: 0 → 3 songs, 4 points`
   - `Updated submission: 3 → 7 songs, 8 points`

4. **Show completes successfully**
   - `Show complete: true`
   - `Summary: 0 in progress, 1 completed`

### ⚠️ Warning Signs

1. **No setlist data**
   - `No setlist data returned from API`
   - **Possible causes:**
     - Phish.net hasn't posted setlist yet (normal early in show)
     - API is down
     - Date mismatch issue

2. **No shows found**
   - `Found 0 show(s) to check`
   - **Possible causes:**
     - No shows have locked yet (normal before 7 PM)
     - Show's `lockTime` is not set correctly
     - No submissions for the show

3. **Authorization errors**
   - `✗ Unauthorized - invalid CRON_SECRET`
   - **Fix:** Check `CRON_SECRET` is set in Vercel environment variables

4. **API errors**
   - `✗ Error scoring shows:`
   - Check the error details in the logs

## Testing Right Now

You can test the cron locally before deploying:

```bash
# Start dev server
npm run dev

# In another terminal, trigger scoring
curl -X POST http://localhost:3000/api/score \
  -H "Authorization: Bearer YOUR_CRON_SECRET"
```

You should see all the new `[Score]` logs in your terminal!

## Debugging Tips

### If scores aren't updating:

1. **Check the GET endpoint**

   ```bash
   curl https://your-domain.com/api/score
   ```

   This shows pending shows and their status

2. **Manually trigger scoring**

   ```bash
   curl -X POST https://your-domain.com/api/score \
     -H "Authorization: Bearer YOUR_CRON_SECRET"
   ```

3. **Check Vercel logs for errors**
   - Look for `✗` symbols in the logs
   - Check error details in the response

### If setlist isn't appearing:

1. **Verify the show date**
   - Check that show date in DB matches Phish.net format (YYYY-MM-DD)
   - Look for timezone mismatch logs

2. **Check Phish.net directly**
   - Visit: https://phish.net/setlists/
   - Confirm setlist is posted

3. **Check API response**
   - Look for `API Response:` in logs
   - Verify JSON structure

## Additional Logging Ideas

If you need even more debugging info during the show, we can add:

- User email/name for each submission update
- Detailed pick-by-pick scoring breakdown
- Phish.net API response time
- Database query times
- Webhook/notification on score updates

Let me know if you want any of these added!
