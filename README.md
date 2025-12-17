# FantasyPhish

A fantasy game for Phish fans. Pick 13 songs before each show, score points when they play your picks, and compete on the tour leaderboard.

## Features

- **Pick 13 Songs**: Select your opener (3 pts), encore (3 pts), and 11 regular songs (1 pt each)
- **Lock Before Showtime**: Submissions lock automatically when the show starts
- **Auto-Scoring**: Picks are scored automatically after each show using phish.net data
- **Tour Leaderboards**: Compete with other fans on tour-based leaderboards
- **Pick History**: View all your past submissions and scores

## Tech Stack

- **Next.js 14** with App Router
- **TypeScript**
- **Prisma** + PostgreSQL (Vercel Postgres)
- **NextAuth.js** for authentication
- **Tailwind CSS** for styling
- **Resend** for email verification
- **phish.net API** for setlist data

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
AUTH_SECRET="generate-with: openssl rand -base64 32"
NEXTAUTH_URL="http://localhost:3000"

# phish.net API
PHISHNET_API_KEY="your-phishnet-api-key"

# Resend (Email)
RESEND_API_KEY="re_..."

# App URL (for email links)
NEXT_PUBLIC_APP_URL="http://localhost:3000"
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

## Deployment to Vercel

1. Push code to GitHub
2. Import project in Vercel
3. Add Vercel Postgres database
4. Set environment variables:
   - `AUTH_SECRET` (generate with `openssl rand -base64 32`)
   - `PHISHNET_API_KEY`
   - `RESEND_API_KEY`
   - `NEXT_PUBLIC_APP_URL` (your Vercel URL)
5. Deploy

After deployment:
1. Run `npm run db:seed` to seed the songs database
2. The cron job (`/api/score`) runs at midnight UTC daily to score completed shows

## Scoring System

| Pick Type | Points |
|-----------|--------|
| Opener (first song of Set 1) | 3 points |
| Encore (any song in encore) | 3 points |
| Regular (11 songs, played anywhere) | 1 point each |
| **Maximum per show** | **17 points** |

## Project Structure

```
src/
├── app/
│   ├── (auth)/         # Login, register, verify pages
│   ├── (main)/         # Dashboard, pick, history, leaderboard
│   ├── api/            # API routes
│   └── page.tsx        # Landing page
├── components/         # React components
├── lib/               # Utilities (auth, prisma, phishnet, scoring)
└── types/             # TypeScript types
```

## API Routes

- `POST /api/auth/register` - User registration
- `GET /api/auth/verify` - Email verification
- `GET/POST /api/picks` - Get/submit picks for a show
- `GET /api/shows` - Get upcoming shows
- `GET /api/songs` - Get all songs
- `GET /api/history` - Get user's submission history
- `GET /api/leaderboard` - Get tour leaderboard
- `POST /api/score` - Score completed shows (cron job)

## License

MIT
