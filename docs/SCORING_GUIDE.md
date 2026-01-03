# Scoring System Guide

## 🎯 How It Works

### Timezone-Aware Locking

- Shows lock at **7 PM in the venue's timezone**
- Falls back to checking if setlist has started if timezone not set
- Lock time is calculated when first user submits picks

### Progressive Scoring

- Cron job runs **every 5 minutes**
- Fetches setlist from Phish.net API
- Updates scores as new songs are added
- Marks show complete when encore appears

### Point System

- **Opener**: 3 points (must be first song of Set 1)
- **Encore**: 3 points (must be in encore set)
- **Regular**: 1 point each (anywhere in setlist)
- **Maximum**: 17 points (3 + 3 + 11×1)

---

## 🧪 Testing Locally

### 1. Start Dev Server

```bash
npm run dev
```

### 2. Check Scoring Status

```bash
# GET - Check what shows are pending
curl http://localhost:3000/api/score

# Response:
# {"pendingShows":[]} - No shows need scoring
# {"pendingShows":[{...}]} - Shows with unscored submissions
```

### 3. Manually Trigger Scoring

```bash
# POST - Run scoring now
curl -X POST http://localhost:3000/api/score

# Response:
# {
#   "success": true,
#   "results": {
#     "progressiveShows": [...],  // Shows in progress
#     "completeShows": [...]      // Shows marked complete
#   }
# }
```

### 4. Set Up Test Data

**Create a show with timezone:**

```sql
UPDATE "Show"
SET timezone = 'America/New_York',
    state = 'NY',
    lockTime = NOW() - INTERVAL '2 hours'  -- Lock 2 hours ago
WHERE id = 'your-show-id';
```

**Submit picks for the show** (via UI at `/pick/[showId]`)

**Run scoring:**

```bash
curl -X POST http://localhost:3000/api/score
```

**Check results** (via UI at `/results/[showId]` - coming soon)

---

## 📊 API Endpoints

### Scoring

- **POST /api/score** - Trigger scoring (cron)
- **GET /api/score** - Check pending shows

### Results

- **GET /api/results/[showId]** - Get scored picks for a show
  - Returns: picks, scores, setlist, show status

### Shows

- **GET /api/shows/[showId]** - Get show details
  - Includes: isLocked, lockTime, timezone

---

## 🔧 Database Queries

### Check Show Lock Status

```sql
SELECT
  id,
  venue,
  "showDate",
  timezone,
  "lockTime",
  "isComplete",
  "lastScoredAt"
FROM "Show"
WHERE id = 'your-show-id';
```

### Check Submissions

```sql
SELECT
  u.email,
  s."isScored",
  s."totalPoints",
  s."lastSongCount",
  COUNT(p.id) as pick_count
FROM "Submission" s
JOIN "User" u ON s."userId" = u.id
LEFT JOIN "Pick" p ON p."submissionId" = s.id
WHERE s."showId" = 'your-show-id'
GROUP BY u.email, s."isScored", s."totalPoints", s."lastSongCount";
```

### Check Pick Scores

```sql
SELECT
  u.email,
  so.name as song,
  p."pickType",
  p."wasPlayed",
  p."pointsEarned"
FROM "Pick" p
JOIN "Submission" su ON p."submissionId" = su.id
JOIN "User" u ON su."userId" = u.id
JOIN "Song" so ON p."songId" = so.id
WHERE su."showId" = 'your-show-id'
ORDER BY u.email, p."pickType";
```

---

## 🚨 Troubleshooting

### "Show has already started. Submissions are locked."

- Check show's `lockTime`: `SELECT "lockTime" FROM "Show" WHERE id = '...'`
- If lock time is wrong, update: `UPDATE "Show" SET "lockTime" = NULL WHERE id = '...'`
- Lock time will recalculate on next pick submission

### Scoring not running

1. Check cron is configured: `vercel.json` should have `*/5 * * * *`
2. Check `CRON_SECRET` env var is set (if using auth)
3. Manually trigger: `curl -X POST http://localhost:3000/api/score`
4. Check server logs for errors

### Scores not updating

1. Check show is locked: `lockTime <= NOW()`
2. Check Phish.net API is returning setlist
3. Check `lastScoredAt` is updating
4. Check `lastSongCount` is incrementing

### Timezone issues

1. Check show has timezone set: `SELECT timezone, state FROM "Show"`
2. If missing, set: `UPDATE "Show" SET timezone = 'America/New_York' WHERE state = 'NY'`
3. Or run sync script to bulk update all shows

---

## 🎸 Example Flow

1. **User submits picks at 6:30 PM ET**
   - Show date: 2025-01-15
   - Venue: Madison Square Garden, NY
   - Timezone: America/New_York
   - Lock time: 2025-01-15 19:00:00 EST (midnight UTC)

2. **7:00 PM ET - Show locks**
   - New submissions rejected
   - Existing submissions can no longer be edited

3. **7:35 PM ET - Show starts**
   - Phish.net API gets first song
   - Cron job (next 5-min interval) scores:
     - Opener picks scored
     - Other picks not scored yet (no encore)

4. **8:45 PM ET - Set 1 ends**
   - Multiple songs added
   - Regular picks scored progressively

5. **10:30 PM ET - Encore starts**
   - Encore songs appear in setlist
   - Show marked `isComplete = true`
   - All submissions marked `isScored = true`
   - Final scores calculated

---

## 💡 Tips

- **Local testing**: Set `lockTime` in past to bypass lock
- **Admin testing**: Use upcoming admin interface to apply random setlists
- **Vercel cron**: Runs every 5 minutes automatically in production
- **Cost**: Phish.net API calls = # of locked shows × 12/hour (5 min intervals)

---

## 📝 Next Steps

See `IMPLEMENTATION_STATUS.md` for remaining tasks:

- Results page with auto-refresh
- Admin interface for testing
- E2E tests
- Timezone sync script
