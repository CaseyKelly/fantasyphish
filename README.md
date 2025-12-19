# FantasyPhish

A fantasy game for Phish fans. Pick 13 songs before each show, score points when they play your picks, and compete on the tour leaderboard.

## Features

- **Pick 13 Songs**: Select your opener (3 pts), encore (3 pts), and 11 regular songs (1 pt each)
- **Timezone-Aware Locking**: Submissions lock at 7 PM in the venue's timezone
- **Progressive Scoring**: Live score updates every 5 minutes as songs are played
- **Real-Time Results**: View your scores with auto-refresh during shows
- **Tour Leaderboards**: Compete with other fans on tour-based leaderboards
- **Pick History**: View all your past submissions and scores
- **Admin Panel**: Test scoring with random historical setlists

## Tech Stack

- **Next.js 16** with App Router
- **TypeScript** (Strict mode)
- **Prisma** + PostgreSQL (Vercel Postgres)
- **NextAuth.js v5** for authentication
- **Tailwind CSS v4** for styling
- **Resend** for email verification
- **phish.net API** for setlist data
- **Vercel Cron** for automated scoring and tour sync

## Getting Started

### Prerequisites

- Node.js 18+
- PostgreSQL database (or Vercel Postgres)
- phish.net API key
- Resend API key

### Environment Variables

Create a `.env` file based on `.env.example`:

```bash
# Database (Vercel Postgres)
DATABASE_URL="postgres://..."
DIRECT_URL="postgres://..."

# NextAuth
AUTH_SECRET=""
NEXTAUTH_URL="http://localhost:3000"

# phish.net API
PHISHNET_API_KEY="your-phishnet-api-key"

# Resend (Email)
RESEND_API_KEY="re_..."

# App URL (for email links)
NEXT_PUBLIC_APP_URL="http://localhost:3000"

# Cron Secret (for scheduled jobs)
CRON_SECRET=""
```

### Installation

```bash
# Install dependencies
npm install

# Push database schema
npm run db:push

# Seed songs from phish.net
npm run db:seed

# Optionally sync tours for a specific year
npm run db:sync-tours 2024

# Start development server
npm run dev
```

Visit `http://localhost:3000` to see the app.

### Setting Up an Admin User

To access the admin panel, you need to mark a user as an admin in the database:

```sql
UPDATE "User" SET "isAdmin" = true WHERE email = 'your@email.com';
```

## Deployment to Vercel

1. Push code to GitHub
2. Import project in Vercel
3. Add Vercel Postgres database
4. Set environment variables:
   - `AUTH_SECRET` (generate with `openssl rand -base64 32`)
   - `CRON_SECRET` (generate with `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`)
   - `PHISHNET_API_KEY`
   - `RESEND_API_KEY`
   - `NEXT_PUBLIC_APP_URL` (your Vercel URL)
5. Deploy

After deployment:

1. Run database migration: `npm run db:push`
2. Seed songs: `npm run db:seed`
3. The cron jobs will run automatically:
   - Scoring: Every 5 minutes (`/api/score`)
   - Tour sync: Daily at 6 AM UTC (`/api/sync-tours`)
4. Set at least one user as admin (see above)

See [CRON_JOBS.md](CRON_JOBS.md) for detailed cron configuration and monitoring.

## Scoring System

| Pick Type                           | Points        |
| ----------------------------------- | ------------- |
| Opener (first song of Set 1)        | 3 points      |
| Encore (any song in encore)         | 3 points      |
| Regular (11 songs, played anywhere) | 1 point each  |
| **Maximum per show**                | **17 points** |

## Project Structure

```
src/
├── app/
│   ├── (auth)/         # Login, register, verify pages
│   ├── (main)/         # Dashboard, pick, history, results, leaderboard, admin
│   ├── api/            # API routes
│   └── page.tsx        # Landing page
├── components/         # React components
├── lib/               # Utilities (auth, prisma, phishnet, scoring, timezone)
└── types/             # TypeScript types
```

## API Routes

### User Endpoints

- `POST /api/auth/register` - User registration
- `GET /api/auth/verify` - Email verification
- `GET /api/shows` - Get upcoming shows
- `GET /api/songs` - Get all songs
- `GET/POST /api/picks` - Get/submit picks for a show
- `GET /api/results/[showId]` - Get scored picks and setlist for a show
- `GET /api/history` - Get user's submission history
- `GET /api/leaderboard` - Get tour leaderboard

### Cron Endpoints (Require CRON_SECRET)

- `POST /api/score` - Progressive scoring (runs every 5 minutes)
- `POST /api/sync-tours` - Sync tour data (runs daily at 6 AM UTC)

### Admin Endpoints (Require admin user)

- `POST /api/admin/test-scoring` - Test scoring with random setlist
- `POST /api/admin/reset-show` - Reset show scores and setlist

## Documentation

- [CRON_JOBS.md](CRON_JOBS.md) - Cron job configuration and monitoring
- [SCORING_GUIDE.md](SCORING_GUIDE.md) - How the scoring system works
- [AGENTS.md](AGENTS.md) - Guidelines for AI coding agents

## License

MIT
