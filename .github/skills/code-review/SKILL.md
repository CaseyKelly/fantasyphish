---
name: code-review
description: Project-specific conventions and pitfalls to check for when reviewing pull requests in this repository. Use this whenever reviewing a pull request or diff in this codebase.
---

FantasyPhish is a Next.js 16 (App Router) fantasy game for Phish fans: users
pick 13 songs per show, a cron job scores picks progressively as the setlist
comes in from phish.net, and results feed tour leaderboards and achievements.
The full architecture is documented in `CLAUDE.md` and `AGENTS.md` at the repo
root — read those first for broader context. This skill lists the things
generic review misses because they're specific to this codebase.

## Pick locking must not be bypassable

Picks lock at 7 PM in the venue's timezone (`src/lib/timezone.ts`). Flag any
change that:

- Lets `POST /api/picks` (`src/app/api/picks/route.ts`) create or modify a
  submission without going through the "show has started" check
  (`hasShowStarted(...)`) first.
- Computes a lock time from the server's local time or the browser's
  timezone instead of the show's `timezone` (falling back to
  `getTimezoneForLocation(show.state)`).
- Derives a show's calendar date with anything other than
  `showDate.toISOString().split("T")[0]` — `showDate` is stored as UTC
  midnight, so local-time date methods can shift it by a day.

## Scoring rules and progressive scoring

`src/lib/scoring.ts` and `src/lib/show-scoring.ts` implement the scoring.
Points are fixed: opener (first song of Set 1) = 3, encore (any encore song)
= 3, each of the 11 regular picks played anywhere = 1, max 17 per show. Flag:

- Any change to those point values or to what counts as opener/encore that
  isn't called out as an intentional rules change in the PR description.
- Song comparisons that don't go through `normalizeSongName()` from
  `src/lib/phishnet.ts` — raw string equality misses punctuation/case
  variants and silently costs users points.
- `getSetlist(...)` calls in the scoring path without `{ noCache: true }` —
  cached setlists mean picks stop scoring mid-show.
- Changes that reset or ignore `Submission.lastSongCount`, or that overwrite
  `Pick.wasPlayed` from `true` back to `false`/`null` on a later scoring pass.
- Code that treats `Pick.wasPlayed === false` as a final miss. During a live
  show `scoreSubmission()` sets unplayed REGULAR picks to `false` on every
  pass (opener/encore picks stay `null` until that part of the show starts),
  so `false` is provisional. Only `Submission.isScored` (set once the grace
  period expires) means a submission's results are final — UI or logic that
  shows a pick as a definite miss must check it.

## Show completion grace period

A show is marked `isComplete` only after `GRACE_PERIOD_MS` (60 min,
`src/lib/scoring-constants.ts`) has passed since the last new encore song.
`Show.encoreStartedAt` is reset whenever `lastEncoreCount` grows. Flag any
change that marks a show complete as soon as an encore appears, or that
stops resetting the timer when more encore songs are added (multi-song
encores would get cut off).

## Completed shows are frozen

`src/app/api/sync-tours/route.ts` must skip shows where `isComplete` is
`true` — their setlist/score data comes from the scoring cron, and a sync
would overwrite it. Flag any new write path to `Show` (sync, admin tooling,
scripts) that doesn't respect this unless it's an explicit admin action like
`reset-show`.

## Cron routes

Cron endpoints (`score`, `sync-tours`, `sync-song-stats`,
`award-achievements`, `send-reminders`) run on Vercel cron. For a new or
changed cron route, check that it:

- Authenticates with `verifyCronRequest()` from `src/lib/cron-auth.ts`
  before doing any work. It requires `Authorization: Bearer ${CRON_SECRET}`
  (Vercel sends this header on cron invocations when `CRON_SECRET` is
  configured) and fails closed when the secret is unset. Flag a cron route
  that skips it or rolls its own check, especially one that accepts a
  `User-Agent` such as `Vercel-Cron` as proof of origin (any caller can set
  it) or that allows requests when the secret is missing.
- Calls `shouldRunCronJobs()` (`src/lib/cron-helpers.ts`) early, where the
  job only matters during an active tour.
- Wraps every Prisma call in `withRetry(..., { operationName })` from
  `src/lib/db-retry.ts`; Neon connections drop transiently and an unwrapped
  call fails the whole run.
- Stays idempotent: running it twice must not double-award achievements,
  double-count points, or duplicate rows.

## Achievements are idempotent

Achievements are awarded inline during scoring (`processPickAchievements` in
`src/lib/achievement-awards.ts`) and again by the daily backup cron. Any new
award path must check for an existing `UserAchievement` before creating
one, as `awardPickAchievement` does. The
`@@unique([userId, achievementId])` constraint makes duplicate rows
impossible, so a missing check shows up as a Prisma unique-constraint
error (`P2002`) that can fail a scoring or backup cron run — check that new
award code either looks up first or catches that error.

## Database changes need a migration

Schema changes to `prisma/schema.prisma` must ship with a new directory under
`prisma/migrations/` generated by `npm run db:migrate` — the build runs
`prisma migrate deploy`, so a schema edit without a migration (i.e. made with
`db:push`) never reaches production. Also flag migrations that drop or
rename columns still read by code in the same PR, or that aren't safe to run
against existing production rows (e.g. adding a `NOT NULL` column with no
default).

## Auth and private pages

- Owner-only pages (e.g. `/submissions`) must gate on
  `isPrivateViewerOwner()` from `src/lib/private-access.ts`, which fails
  closed when `PRIVATE_VIEWER_EMAIL` is unset. Never hardcode an email or
  fall back to "allow" when the env var is missing.
- Every admin endpoint under `src/app/api/admin/` must check
  `isAdminFeaturesEnabled()` (`src/lib/env.ts`) and must derive admin status
  from the session or database, never from the request body.
  `User.isAdmin` is separate from private-viewer access.
- While an admin impersonates a user, `session.user` (`id`, `isAdmin`) is
  the impersonated user's, and the real admin lives in
  `session.impersonating` (`originalUserId`, `originalIsAdmin`). Admin
  routes split into two kinds:
  - Ordinary admin actions (e.g. `reset-show`) check
    `session.user.isAdmin`, so they're unavailable while impersonating a
    non-admin.
  - Impersonation-aware routes authorize the original admin instead:
    `impersonate`, `stop-impersonate` and `users` use
    `session.impersonating`, and `set-show-lock-override` uses
    `session.impersonating?.originalIsAdmin ?? session.user.isAdmin`. Don't
    flag these for "not checking `session.user.isAdmin`" — `stop-impersonate`
    must work while the session user is a non-admin. Do flag a change that
    trusts `session.impersonating` without it having been set by the
    `impersonate` flow in `src/lib/auth.ts`, or that drops it so "stop
    impersonating" can't restore the admin.

## API route conventions

- Validate request bodies with Zod (see `src/app/api/picks/schema.ts`).
- Return errors as `NextResponse.json({ error }, { status })` with a
  non-200 status — not a thrown error left unhandled.

## e2e tests share one database

CI runs Playwright spec files across 4 workers against a single Neon branch.
New or changed specs under `tests/e2e/` must generate unique
usernames/emails with `uniqueUsername()` from `tests/e2e/helpers/fixtures.ts`
and must not hardcode a `showDate` already reserved in the note atop
`tests/e2e/shows.spec.ts` — collisions show up as flaky failures in other
spec files, not in the one that caused them.

## Non-goals for this skill

Don't re-review formatting, lint, or type errors that `npm run lint`,
`npm run format`, and `npm run typecheck` already catch, and don't review
`package-lock.json` or Renovate dependency bumps beyond checking that the
lockfile change matches the `package.json` change.
