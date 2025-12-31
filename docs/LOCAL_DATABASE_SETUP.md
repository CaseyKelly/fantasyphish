# Local Database Setup

This guide explains how to safely work with a development database using Neon branches while keeping your production database safe.

## Quick Start

### 1. Update Your .env.local

Update your `.env.local` file:

```env
# Environment - CRITICAL: Set this to development for local work
NODE_ENV="development"

# Neon Project ID (find in Neon dashboard)
NEON_PROJECT_ID="your-project-id"

# Production database (main branch)
PROD_DATABASE_URL="postgresql://neondb_owner:npg_xxx@ep-xxx-pooler.neon.tech/neondb?sslmode=require"

# Development database (Neon branch - will be created in step 2)
DATABASE_URL="postgresql://neondb_owner:npg_xxx@ep-xxx-pooler.neon.tech/neondb?sslmode=require&options=branch%3Ddev"
```

### 2. Create a Neon Development Branch

Create a branch from your production database for safe local development:

```bash
npm run db:create-branch
```

This will:

1. Create a new Neon branch called `dev`
2. Copy all data from your main (production) branch
3. Give you a connection string to add to `.env.local`

The branch is completely isolated from production - you can experiment freely!

### 3. Start Developing

Now you can safely run scripts without worrying about production:

```bash
npm run dev                    # Start development server
npm run db:sync-tours          # Sync tours (only affects dev branch)
npm run db:seed                # Seed songs (only affects dev branch)
```

## Why Use Neon Branches?

- **Zero Setup**: No need to install PostgreSQL locally
- **Instant Clones**: Create a copy of production in seconds
- **Perfect Isolation**: Changes to your branch never affect production
- **Easy Reset**: Recreate from production anytime with `npm run db:reset-branch`
- **Cost Effective**: Branches are free and automatically managed by Neon

## Managing Your Development Branch

### Reset Branch (Get Fresh Production Data)

Anytime you want to reset your development branch with fresh production data:

```bash
npm run db:reset-branch
```

This will:

1. Delete your `dev` branch
2. Create a new `dev` branch from main (production)
3. Give you a fresh copy of all production data

This is useful when:

- You've messed up your development data and want to start over
- You want to test against the latest production data
- You want to clear out test data

### List All Branches

See all Neon branches in your project:

```bash
npm run db:list-branches
```

## Safety Features

### Automatic Protection

All data-modifying scripts now include safety checks:

- **Environment Check**: Scripts check `NODE_ENV` and will refuse to write to production unless explicitly set
- **Database URL Comparison**: Scripts verify DATABASE_URL ≠ PROD_DATABASE_URL
- **Branch Detection**: Scripts detect and allow Neon branch URLs (they're safe!)
- **Warning Prompts**: If you do run against production, you get a 3-second warning to cancel

### Example Success Message

When running against a Neon branch:

```
✅ Using Neon branch database (safe for development)
```

### Example Error Message

If you try to run a script against production in development mode:

```
⚠️  SAFETY CHECK FAILED!
You are trying to sync tours to the PRODUCTION database.
Your NODE_ENV is: development
But DATABASE_URL is identical to PROD_DATABASE_URL.

To fix this:
1. Create a Neon branch for development:
   npm run db:create-branch
2. Update your .env.local with the branch URL
3. Set NODE_ENV=development in your .env.local

Or, if you really want to sync production, run:
   NODE_ENV=production npm run db:sync-tours
```

## Working with Production Data

### To Intentionally Run Against Production

If you need to run a script against production (rare!), explicitly set the environment:

```bash
NODE_ENV=production npm run db:sync-tours
```

You'll still get a 3-second warning to cancel.

## Database Scripts

### Neon Branch Management

- `npm run db:create-branch` - Create a new development branch
- `npm run db:reset-branch` - Reset development branch with fresh production data
- `npm run db:list-branches` - List all Neon branches

### Data Scripts

- `npm run db:sync-tours` - Sync tours from Phish.net API
- `npm run db:seed` - Seed songs from Phish.net API

### Schema Management

- `npm run db:push` - Push Prisma schema changes to database
- `npm run db:migrate` - Create and run migrations

### Legacy (if using local PostgreSQL instead of Neon)

- `npm run db:restore-from-prod` - Copy production data to local PostgreSQL

## Troubleshooting

### "relation already exists" errors

Reset your development branch to get a fresh copy:

```bash
npm run db:reset-branch
```

### neonctl not found

Install the Neon CLI:

```bash
npm install -g neonctl
```

### Can't create branch

Make sure you've set `NEON_PROJECT_ID` in your `.env.local`. Find it in your Neon dashboard under Project Settings.

## Best Practices

1. **Always use `NODE_ENV=development` locally** - This is your primary safety net
2. **Use a Neon branch for development** - Never point `DATABASE_URL` at production
3. **Refresh from production regularly** - Run `npm run db:reset-branch` weekly to keep your dev data fresh
4. **Test scripts on your branch first** - Always test data-modifying scripts on your dev branch before running against production
5. **Check for branch indicator** - Look for "✅ Using Neon branch database" when running scripts

## Alternative: Local PostgreSQL

If you prefer to use a local PostgreSQL database instead of Neon branches, you can still do that:

1. Install PostgreSQL locally:

```bash
brew install postgresql@15
brew services start postgresql@15
```

2. Update your `.env.local`:

```env
DATABASE_URL="postgresql://user:password@localhost:5432/fantasyphish_local"
```

3. Use the restore script to copy production data:

```bash
npm run db:restore-from-prod
```

However, Neon branches are recommended because they're:

- Easier to set up (no local installation)
- Faster to reset (seconds vs minutes)
- Identical to production environment
- Free and automatically managed
