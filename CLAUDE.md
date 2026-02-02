# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

FantasyPhish is a fantasy game for Phish fans. Users pick 13 songs before each show, score points when they play their picks, and compete on tour leaderboards. The app uses progressive scoring with timezone-aware locking, achievements, and real-time updates during shows.

## Common Commands

### Development

- `npm run dev` - Start development server
- `npm run build` - Build for production (includes prisma generate)
- `npm run lint` - Run ESLint
- `npm run format` - Format code with Prettier
- `npm run typecheck` - TypeScript type checking

### Testing

- `npm test` - Run all Playwright tests
- `npm test -- tests/e2e/auth.spec.ts` - Run specific test file
- `npm test -- -g "test name"` - Run tests matching pattern
- `npm run test:debug` - Debug tests interactively
- `npm run test:ui` - Run tests with Playwright UI
- `npm run test:headed` - Run tests in headed mode
- `npm run test:trace` - Download and view latest GitHub Actions test traces

### Database

- `npm run db:push` - Sync Prisma schema to database (development)
- `npm run db:migrate` - Create and apply migrations (production)
- `npm run db:seed` - Seed songs from phish.net API
- `npm run db:sync-tours [year]` - Sync tour/show data for specific year
- `npm run db:sync-recent-songs` - Update song gap/lastPlayed stats
- `npm run db:branch` - Neon branching commands (create, reset, list)
- `npm run db:restore-from-prod` - Restore local DB from production

### Utilities

- `npm run watch:scoring` - Watch and debug scoring cron locally

## Code Architecture

### Core Data Flow

**Pick Submission → Locking → Progressive Scoring → Achievements**

1. Users submit picks before show lock time (7 PM venue timezone)
2. Cron job (`/api/score`) runs every 10 minutes during active shows
3. Fetches setlist from phish.net API progressively
4. Updates scores as new songs are added
5. Awards achievements inline during scoring
6. Show marked complete 60 minutes after last encore song

### Scoring System (`src/lib/scoring.ts`)

The scoring logic is split between:

- `scoreSubmission()` - Core scoring logic (opener, encore, regular picks)
- `scoreSubmissionProgressive()` - Wrapper for progressive updates during shows
- Progressive scoring tracks `lastSongCount` to detect new songs
- Encore grace period (60 min) prevents premature completion

**Points:**

- Opener (first song of Set 1): 3 points
- Encore (any song in encore): 3 points
- Regular (11 songs, anywhere): 1 point each
- Maximum: 17 points per show

### Timezone-Aware Locking (`src/lib/timezone.ts`)

Shows lock at 7 PM in the venue's timezone:

- `calculateLockTime()` - Calculates 7 PM venue time from show date
- `calculateIsShowLocked()` - Checks if show has locked
- `getTimezoneForLocation()` - Maps state/province to IANA timezone
- Fallback: Check if setlist has started (via API)

### phish.net API Integration (`src/lib/phishnet.ts`)

All external setlist/show data comes from phish.net v5 API:

- `getSetlist(showDate, { noCache: true })` - Fetch setlist (use noCache during scoring)
- `parseSetlist()` - Extract opener, encoreSongs, allSongs for scoring
- `normalizeSongName()` - Normalize for comparison (lowercase, trim, no punctuation)
- `getShowsByYear(year)` - Fetch all shows for tour sync
- `getAllSongs()` - Fetch all songs for seeding/stats

### Progressive Scoring Cron (`/api/score/route.ts`)

Runs every 10 minutes during active tours (checks `shouldRunCronJobs()`):

1. Find shows with `lockTime <= now` and `isComplete = false`
2. Fetch fresh setlist with `{ noCache: true }`
3. Score all submissions progressively
4. Award achievements inline via `processPickAchievements()`
5. Track `encoreStartedAt` and `lastEncoreCount` for grace period
6. Mark complete 60 minutes after last encore song

**Grace Period Logic:**

- When encore detected: Set `encoreStartedAt` = now
- If more encore songs added: Reset `encoreStartedAt` = now
- Mark complete: `encoreStartedAt + 60 minutes < now`

### Achievement System

Two-part system:

1. **Inline awarding** during scoring cron (`src/lib/achievement-awards.ts`)
   - Awards PERFECT_OPENER and PERFECT_CLOSER immediately when earned
   - Called via `processPickAchievements()` in scoring cron
2. **Backup cron** (`/api/award-achievements`) runs daily at 8 AM UTC
   - Safety net to catch any missed achievements
   - Fully idempotent (skips existing awards)

Achievement definitions in `src/lib/achievements.ts`:

- Each has slug, name, description, icon, category, metadata
- Metadata stores context (show date, venue, song name for picks)

### Database Schema (Prisma)

Key relationships:

- `Tour` → `Show[]` (one-to-many)
- `Show` → `Submission[]` (one-to-many)
- `Submission` → `Pick[]` (one-to-many)
- `User` → `Submission[]` (one-to-many)
- `User` → `UserAchievement[]` (many-to-many via join table)
- `Achievement` → `UserAchievement[]` (many-to-many via join table)

Important fields:

- `Show.lockTime` - When picks locked (7 PM venue timezone)
- `Show.isComplete` - Show complete (after grace period)
- `Show.encoreStartedAt` - When encore first detected (for grace period)
- `Show.lastEncoreCount` - Track encore count to detect resets
- `Submission.lastSongCount` - Track song count for progressive scoring
- `Pick.wasPlayed` - Tri-state: null (not scored), true, false

### NextAuth v5 Setup (`src/lib/auth.ts`)

- Credentials provider with bcrypt password hashing
- JWT strategy with session callbacks
- Supports user impersonation for admins (stored in token)
- Email verification required before login
- Username + email stored in session

### Cron Jobs (vercel.json)

All cron endpoints require `CRON_SECRET` or Vercel-Cron user-agent:

1. **Scoring** (`/api/score`) - Every 10 minutes
   - Only runs when active tours exist (via `shouldRunCronJobs()`)
   - Progressive scoring with fresh setlist data
   - Awards achievements inline

2. **Tour Sync** (`/api/sync-tours`) - Daily at 6 AM UTC
   - Syncs current year + next year shows
   - Creates/updates tours and shows
   - **Never updates shows with `isComplete = true`** (preserves setlists)
   - Sets timezone and calculates lockTime
   - Fully idempotent

3. **Song Stats Sync** (`/api/sync-song-stats`) - Daily at 7 AM UTC
   - Updates `timesPlayed`, `gap`, `lastPlayed` for all songs
   - Powers "played X shows ago" UI feature

4. **Award Achievements** (`/api/award-achievements`) - Daily at 8 AM UTC
   - Backup/safety net for achievement awarding
   - Awards PERFECT_OPENER and PERFECT_CLOSER
   - Fully idempotent

### Route Structure

```
src/app/
├── (auth)/              # Unauthenticated pages (login, register, verify)
├── (main)/              # Authenticated pages (pick, results, leaderboard)
│   ├── pick/[showId]/   # Song picker (locks at 7 PM venue time)
│   ├── results/         # Show results with live refresh
│   ├── leaderboard/     # Tour leaderboards
│   └── profile/         # User profile with achievements
├── api/
│   ├── auth/            # Registration, verification, NextAuth
│   ├── score            # Progressive scoring cron
│   ├── sync-tours       # Tour/show sync cron
│   ├── sync-song-stats  # Song stats sync cron
│   ├── award-achievements # Achievement backup cron
│   ├── picks            # Submit/fetch picks
│   ├── results/[showId] # Scored picks and setlist
│   ├── shows            # Upcoming/recent shows
│   ├── songs            # All songs with stats
│   ├── leaderboard      # Tour leaderboard
│   └── admin/           # Admin endpoints (test-scoring, reset-show, impersonate)
└── page.tsx             # Public landing page
```

### Path Aliases

Use `@/*` for all src/ imports:

```typescript
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { scoreSubmission } from "@/lib/scoring"
```

### Code Style (from AGENTS.md)

- **TypeScript:** Strict mode, explicit types for function params/returns
- **Formatting:** 2-space indent, double quotes, no semicolons
- **Components:** Functional components, "use client" for client components
- **Naming:** camelCase (functions/vars), PascalCase (components/types), SCREAMING_SNAKE (enums)
- **Error handling:** API routes return `NextResponse.json({ error }, { status })`
- **Validation:** Zod schemas for API request validation

### Database Retry Logic (`src/lib/db-retry.ts`)

All Prisma operations in cron jobs should use `withRetry()`:

```typescript
await withRetry(
  async () => prisma.show.findMany({ ... }),
  { operationName: "find shows to score" }
)
```

Handles transient connection errors (exponential backoff, 3 retries).

### Critical Implementation Notes

1. **Never update completed shows in sync-tours**
   - Check `isComplete = true` before updating show data
   - Preserves setlist data from scoring

2. **Use noCache during progressive scoring**
   - `getSetlist(showDate, { noCache: true })`
   - Ensures fresh data during shows

3. **Grace period prevents premature completion**
   - Track `encoreStartedAt` and `lastEncoreCount`
   - Reset timer when new encore songs added
   - 60 minute grace period

4. **Inline achievement awarding**
   - Primary: Award during scoring cron (`processPickAchievements`)
   - Backup: Daily cron catches missed awards
   - Both are fully idempotent

5. **Cron jobs only run when tours are active**
   - `shouldRunCronJobs()` checks for ACTIVE or FUTURE tours
   - Reduces API calls when Phish is on break

6. **Timezone handling for show dates**
   - Always use `showDate.toISOString().split("T")[0]` for API calls
   - Prevents timezone conversion issues

7. **Song name normalization**
   - Use `normalizeSongName()` for all comparisons
   - Handles punctuation, spacing, case differences

8. **Test parallelization**
   - Playwright config uses `workers: 1` to avoid Resend API rate limits
   - Tests run sequentially, not in parallel

## Environment Variables

Required for development:

- `DATABASE_URL` - Postgres connection string
- `DIRECT_URL` - Direct Postgres connection (Vercel Postgres)
- `AUTH_SECRET` - NextAuth secret
- `NEXTAUTH_URL` - App URL (http://localhost:3000)
- `PHISHNET_API_KEY` - phish.net API key
- `RESEND_API_KEY` - Email service API key
- `NEXT_PUBLIC_APP_URL` - Public app URL
- `CRON_SECRET` - Cron job authentication (optional locally)

## Common Pitfalls

1. **Timezone issues:** Always extract show dates as UTC to avoid conversion
2. **Completed shows:** Never update shows with `isComplete = true` in sync
3. **Caching:** Use `noCache: true` when fetching setlists during scoring
4. **Song matching:** Always normalize song names before comparison
5. **Achievement idempotency:** Always check if user already has achievement
6. **Database retries:** Wrap all cron job Prisma calls in `withRetry()`
7. **Grace period:** Don't mark shows complete until grace period expires
8. **Active tours check:** Cron jobs should check `shouldRunCronJobs()` first
