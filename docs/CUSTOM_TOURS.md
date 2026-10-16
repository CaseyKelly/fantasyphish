# Custom Tours

## Overview

You can create custom tours that won't be overwritten by the phish.net sync process. This is useful for grouping shows in a way that makes sense for your users, even if phish.net categorizes them differently.

## How It Works

### Tour ID Prefixes

- **phish.net tours**: ID format `phishnet-{tourid}` (e.g., `phishnet-212`)
- **Custom tours**: ID format `custom-{slug}` (e.g., `custom-sphere-2026`)

The sync process will:

- ✅ Update shows assigned to `phishnet-*` tours
- ✅ Update shows that are marked `isComplete = true` (never updates completed shows)
- ✅ **Skip shows assigned to `custom-*` tours** (preserves your custom grouping)

### Protection Logic

When `sync-tours` runs, it checks each show:

1. **Is the show complete?** → Skip (preserve setlist data)
2. **Is the show in a custom tour?** → Skip (preserve custom tour assignment)
3. **Otherwise** → Update with phish.net data

## Creating Custom Tours

### Option 1: Via Script (Recommended)

```bash
npx tsx -e "
import { PrismaClient } from '@prisma/client'
import { config } from 'dotenv'

config({ path: '.env.local' })
config({ path: '.env' })

const prisma = new PrismaClient()

async function main() {
  // Create custom tour
  const tour = await prisma.tour.create({
    data: {
      id: 'custom-your-tour-slug',      // Must start with 'custom-'
      name: 'Your Tour Name',
      startDate: new Date('2026-04-16'),
      endDate: new Date('2026-05-02'),
      status: 'FUTURE'                  // Or ACTIVE, COMPLETED, CLOSED
    }
  })

  // Assign shows to the tour
  await prisma.show.updateMany({
    where: {
      showDate: {
        gte: new Date('2026-04-16'),
        lte: new Date('2026-05-02')
      }
    },
    data: {
      tourId: 'custom-your-tour-slug'
    }
  })

  console.log('✓ Custom tour created')
}

main().finally(() => prisma.\$disconnect())
"
```

### Option 2: Via Database

```sql
-- Create tour
INSERT INTO "Tour" (id, name, "startDate", "endDate", status)
VALUES ('custom-fall-2026', 'Fall Tour 2026', '2026-09-01', '2026-10-15', 'FUTURE');

-- Assign shows
UPDATE "Show"
SET "tourId" = 'custom-fall-2026'
WHERE "showDate" BETWEEN '2026-09-01' AND '2026-10-15';
```

## Examples

### Example 1: Sphere 2026

The Sphere 2026 shows were in phish.net's "Not Part of a Tour" category, but we wanted them grouped separately:

```typescript
// Created tour with ID: custom-sphere-2026
// Assigned 9 shows (April-May 2026)
// These shows will never be reassigned by sync-tours
```

### Example 2: Festival

For a multi-day festival that phish.net might categorize differently:

```typescript
await prisma.tour.create({
  data: {
    id: "custom-magnaball-2",
    name: "Magnaball II",
    startDate: new Date("2026-08-21"),
    endDate: new Date("2026-08-23"),
    status: "FUTURE",
  },
})
```

## Naming Conventions

### Tour IDs

- Use lowercase with hyphens
- Start with `custom-`
- Be descriptive but concise
- Examples: `custom-sphere-2026`, `custom-fall-tour-2026`, `custom-nye-run-2026`

### Tour Names

- Use proper capitalization
- Can include special characters
- Examples: "Sphere 2026", "Fall Tour 2026", "NYE Run 2026"

## Syncing With phish.net

### What Gets Synced

The `sync-tours` cron still syncs:

- Tour metadata (name, dates) for phish.net tours
- Show details (venue, city, state, country, lockTime) for shows in phish.net tours
- New shows from phish.net

### What Doesn't Get Synced

- Custom tours (never created or updated by sync)
- Shows assigned to custom tours (tour assignment preserved)
- Shows marked as complete (setlist preserved)

### Running Sync Manually

To test sync behavior without affecting custom tours:

```bash
# The sync will skip all shows in custom tours
curl -X POST https://your-app.vercel.app/api/sync-tours \
  -H "Authorization: Bearer $CRON_SECRET"
```

## Managing Custom Tours

### Viewing Custom Tours

```bash
npx tsx -e "
import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()

prisma.tour.findMany({
  where: { id: { startsWith: 'custom-' } },
  include: { shows: true }
}).then(tours => {
  console.log('Custom Tours:', tours)
  prisma.\$disconnect()
})
"
```

### Deleting a Custom Tour

```bash
# This will NOT delete the shows, just unassign them
npx tsx -e "
import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()

// First, unassign shows (or assign to another tour)
await prisma.show.updateMany({
  where: { tourId: 'custom-your-tour' },
  data: { tourId: 'phishnet-XXX' }  // Or another tour
})

// Then delete the tour
await prisma.tour.delete({
  where: { id: 'custom-your-tour' }
})

prisma.\$disconnect()
"
```

## Important Notes

1. **Always use `custom-` prefix** for custom tour IDs to ensure protection
2. **Shows can only belong to one tour** at a time
3. **Completing a tour** doesn't prevent reassignment - use custom tour IDs instead
4. **Custom tours won't appear** in phish.net API responses (they're local only)

## Troubleshooting

### Shows getting reassigned?

- Check that tour ID starts with `custom-`
- Verify shows are actually assigned to the custom tour
- Check that sync-tours has the updated protection logic

### Custom tour not showing in leaderboard?

- Ensure tour status is set correctly (ACTIVE, FUTURE, COMPLETED)
- Check that shows are properly assigned
- Verify tour dates are correct

### Need to bulk-reassign shows?

```sql
UPDATE "Show"
SET "tourId" = 'custom-new-tour'
WHERE "tourId" = 'phishnet-old-tour';
```
