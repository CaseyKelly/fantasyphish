# Database Connection Fix for Intermittent Errors

## ⚠️ Action Required Before Merge

**You must add the `DIRECT_URL` secret to GitHub Actions before this PR can pass CI:**

1. Go to GitHub repository settings → Secrets and variables → Actions
2. Add new secret: `DIRECT_URL` with your Neon direct connection string (without `-pooler`)
3. Re-run the failed GitHub Actions workflow

See "Required Environment Variables" section below for details.

---

## Problem

Intermittent database connection errors in cron jobs:

```
Can't reach database server at `ep-snowy-paper-ahe53e2g-pooler.c-3.us-east-1.aws.neon.tech:5432`
Error [PrismaClientInitializationError]
```

## Root Causes

1. **Connection pooling issues** - Neon's pooler can timeout idle connections in serverless environments
2. **Multiple Prisma instances** - Some routes were creating their own PrismaClient instead of using the shared singleton
3. **No retry logic** - Transient network issues would immediately fail requests
4. **Missing direct URL** - Prisma needs both pooler URL (for queries) and direct URL (for migrations)

## Solutions Implemented

### 1. Added Retry Logic (`src/lib/db-retry.ts`)

Created a shared utility that retries database operations on connection failures:

- Retries up to 3 times with 1-second delays
- Only retries connection-related errors (P1001, ECONNREFUSED, etc.)
- Logs retry attempts for debugging

### 2. Consolidated Prisma Instances

Updated all API routes to use the shared `prisma` instance from `@/lib/prisma`:

- `src/app/api/score/route.ts` - Already used shared instance
- `src/app/api/sync-tours/route.ts` - Changed from `new PrismaClient()` to shared instance
- `src/app/api/sync-song-stats/route.ts` - Changed from `new PrismaClient()` to shared instance

### 3. Updated Prisma Schema

Added `directUrl` to support Neon's connection pooling architecture:

```prisma
datasource db {
  provider  = "postgresql"
  url       = env("DATABASE_URL")      // Pooler URL for queries
  directUrl = env("DIRECT_URL")        // Direct URL for migrations
}
```

### 4. Wrapped Critical Operations

All database operations in cron jobs now use `withRetry()`:

- Finding shows to score
- Updating show data
- Updating picks and submissions
- Tour syncing operations
- Song stats updates

## Required Environment Variables

You need to add `DIRECT_URL` to both Vercel and GitHub Actions:

### Getting the URLs from Neon

1. Go to your Neon project dashboard
2. Navigate to "Connection Details"
3. You'll see two types of connection strings:

**Pooled connection** (for `DATABASE_URL`):

```
postgresql://user:password@ep-xxx-pooler.us-east-1.aws.neon.tech/dbname?sslmode=require
```

**Direct connection** (for `DIRECT_URL`):

```
postgresql://user:password@ep-xxx.us-east-1.aws.neon.tech/dbname?sslmode=require
```

The difference is `-pooler` in the hostname. The pooler is for queries, direct is for migrations.

### Setting in Vercel

1. Go to your Vercel project settings
2. Navigate to "Environment Variables"
3. Add `DIRECT_URL` with the direct connection string (without `-pooler`)
4. Make sure `DATABASE_URL` has the pooled connection string (with `-pooler`)
5. Set both for all environments (Production, Preview, Development)

### Setting in GitHub Actions

1. Go to your GitHub repository settings
2. Navigate to "Secrets and variables" → "Actions"
3. Add a new repository secret:
   - Name: `DIRECT_URL`
   - Value: Your direct connection string (without `-pooler`)
4. The `DATABASE_URL` secret should already exist with the pooled connection string

## Connection String Format

### DATABASE_URL (Pooler - for queries)

```
postgresql://neondb_owner:password@ep-xxx-pooler.us-east-1.aws.neon.tech:5432/neondb?sslmode=require
```

### DIRECT_URL (Direct - for migrations)

```
postgresql://neondb_owner:password@ep-xxx.us-east-1.aws.neon.tech:5432/neondb?sslmode=require
```

## Optional: Connection Pooling Parameters

You can add these query parameters to `DATABASE_URL` for better connection management:

```
?sslmode=require&connect_timeout=10&pool_timeout=10&statement_cache_size=0
```

- `connect_timeout=10` - Fail fast on connection issues (10 seconds)
- `pool_timeout=10` - How long to wait for a connection from the pool
- `statement_cache_size=0` - Disable prepared statement caching (can help with serverless)

## Testing the Fix

After deploying:

1. Monitor cron job logs in Vercel
2. Look for retry messages: `[DB Retry] operation failed on attempt X/3`
3. Verify that retries succeed instead of failing immediately
4. Check that connection errors are much less frequent

## Monitoring

Watch for these log patterns:

**Before fix:**

```
Error [PrismaClientInitializationError]: Can't reach database server
```

**After fix (transient errors):**

```
[DB Retry] find shows to score failed on attempt 1/3: Can't reach database server
[DB Retry] Retrying in 1000ms...
```

**After fix (successful retry):**

```
[Score:POST] Found 2 show(s) to check
```

## If Issues Persist

1. **Check Neon's status** - Visit status.neon.tech
2. **Review connection limits** - Neon free tier has connection limits
3. **Increase retry attempts** - Edit `maxRetries` in db-retry.ts
4. **Consider upgrading Neon plan** - Higher tiers have better connection pooling
5. **Check function timeout** - Ensure Vercel function timeout is adequate (default 10s, max 60s on Pro)

## Additional Resources

- [Neon Connection Pooling Docs](https://neon.tech/docs/connect/connection-pooling)
- [Prisma Connection Management](https://www.prisma.io/docs/guides/performance-and-optimization/connection-management)
- [Vercel Serverless Functions](https://vercel.com/docs/functions/serverless-functions)
