# Achievements System Production Deployment Guide

## Overview

This guide walks you through safely deploying the achievements system to production, including database migrations and awarding badges to existing users.

---

## Step 1: Pre-Deployment Checklist

**Before you begin:**

- [ ] PR #66 has been reviewed and approved
- [ ] All tests passing in CI/CD
- [ ] You have production database credentials ready
- [ ] You have a database backup (or can quickly create one)

---

## Step 2: Database Migration to Production

### Option A: Using Vercel/Deployment Platform (Recommended)

1. **Merge the PR to main**

   ```bash
   # This will trigger automatic deployment
   gh pr merge 66 --squash
   ```

2. **The deployment will automatically run:**
   - `npm run build` (which includes `prisma generate`)
   - Vercel will detect the new schema
3. **After deployment, push the schema to production database:**

   You'll need to manually run this with production DATABASE_URL:

   ```bash
   # Connect to your production database
   # Option 1: Temporarily update .env.local with prod DATABASE_URL
   # Option 2: Use environment variable inline

   DATABASE_URL="your-production-url" npx prisma db push
   ```

   This will:
   - ✅ Create the `Achievement` table
   - ✅ Create the `UserAchievement` table
   - ✅ Create the `AchievementCategory` enum
   - ✅ Add `achievements` relation to User table
   - ⚠️ **NO data loss** - only adds new tables

### Option B: Using Prisma Migrate (Production Best Practice)

If you want proper migration history:

```bash
# 1. Create a migration from the schema changes
npx prisma migrate dev --name add_achievements_system

# 2. Commit the migration file
git add prisma/migrations
git commit -m "Add achievements migration"
git push

# 3. On production (after deploy):
DATABASE_URL="your-production-url" npx prisma migrate deploy
```

---

## Step 3: Verify Database Migration

After running the migration, verify the tables exist:

```bash
DATABASE_URL="your-production-url" npx tsx -e "
import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
async function check() {
  const count = await prisma.achievement.count();
  console.log('✓ Achievement table exists. Count:', count);
  await prisma.\$disconnect();
}
check();
"
```

Expected output: `✓ Achievement table exists. Count: 0`

---

## Step 4: Award Founding Member Badges

Now that the tables exist, award Founding Member badges to all existing users.

### Create the All-Users Script

I'll create this script next: `scripts/award-founding-member-all-users.ts`

This script will:

- Find all users in the database
- Award Founding Member achievement to each
- Be idempotent (safe to run multiple times)
- Skip users who already have it

### Run the Script

```bash
# On production:
DATABASE_URL="your-production-url" npx tsx scripts/award-founding-member-all-users.ts
```

Or if you want to test on a specific date cutoff:

```bash
# Award to all users created before a certain date
DATABASE_URL="your-production-url" npx tsx scripts/award-founding-member-all-users.ts --before="2025-01-01"
```

---

## Step 5: Award NYE Run Badges (When Ready)

After NYE Run shows have submissions:

```bash
DATABASE_URL="your-production-url" npx tsx scripts/award-nye-run-achievement.ts
```

This will award the NYE Run 2025 badge to anyone who submitted picks for shows between Dec 28, 2024 - Jan 1, 2025.

---

## Step 6: Verify Everything Works

1. **Check a user's profile:**
   - Visit `/profile` while logged in
   - You should see the "Achievements" section
   - Founding Member badge should be visible

2. **Check database counts:**

   ```bash
   DATABASE_URL="your-production-url" npx tsx -e "
   import { PrismaClient } from '@prisma/client';
   const prisma = new PrismaClient();
   async function check() {
     const achievements = await prisma.achievement.count();
     const userAchievements = await prisma.userAchievement.count();
     const users = await prisma.user.count();
     console.log('Achievements defined:', achievements);
     console.log('User achievements awarded:', userAchievements);
     console.log('Total users:', users);
     await prisma.\$disconnect();
   }
   check();
   "
   ```

   Expected output:

   ```
   Achievements defined: 1-2 (Founding Member, maybe NYE Run)
   User achievements awarded: ~[number of users]
   Total users: [your user count]
   ```

---

## Rollback Plan (If Needed)

If something goes wrong:

1. **Revert the deployment:**

   ```bash
   # Roll back to previous Vercel deployment
   vercel rollback
   ```

2. **Remove the database tables (CAUTION):**
   ```bash
   # Only if absolutely necessary
   DATABASE_URL="your-production-url" npx tsx -e "
   import { PrismaClient } from '@prisma/client';
   const prisma = new PrismaClient();
   async function rollback() {
     await prisma.\$executeRaw\`DROP TABLE IF EXISTS UserAchievement CASCADE\`;
     await prisma.\$executeRaw\`DROP TABLE IF EXISTS Achievement CASCADE\`;
     await prisma.\$executeRaw\`DROP TYPE IF EXISTS AchievementCategory\`;
     console.log('✓ Tables dropped');
     await prisma.\$disconnect();
   }
   rollback();
   "
   ```

---

## Future: Adding New Achievements

To add new achievements in the future:

1. **Update** `src/lib/achievements.ts` with new definition
2. **Run the award script** or create a new one for specific criteria
3. **No database migration needed** - achievements table already exists

Example for tour winners:

```typescript
SUMMER_TOUR_2025_CHAMPION: {
  slug: "summer-tour-2025-champion",
  name: "Summer Tour 2025 Champion",
  description: "You won Summer Tour 2025!",
  icon: "Trophy",
  category: "RANKING",
}
```

---

## Support

If you run into issues:

- Check Prisma logs: `DATABASE_URL="..." npx prisma db push --help`
- Verify connection: Test DATABASE_URL can connect
- Check Vercel logs for deployment errors
- Ensure environment variables are set correctly

---

## Summary Checklist

- [ ] Merge PR to main
- [ ] Deployment completes successfully
- [ ] Run `prisma db push` on production database
- [ ] Verify Achievement tables exist
- [ ] Run `award-founding-member-all-users.ts` script
- [ ] Check user profiles show achievements
- [ ] Verify database counts match expectations
- [ ] (Optional) Award NYE Run badges when ready

**Estimated time:** 10-15 minutes
**Risk level:** Low (only adds tables, no existing data modified)
