# GitHub Actions Setup

This document explains how to configure GitHub Actions to run E2E tests on pull requests.

## Required GitHub Secrets

You need to add the following secrets to your GitHub repository:

### How to Add Secrets

1. Go to your GitHub repository
2. Click **Settings** → **Secrets and variables** → **Actions**
3. Click **New repository secret**
4. Add each of the following secrets:

### Required Secrets

#### `RESEND_API_KEY`

Your Resend API key with both **send** and **read** permissions.

- Get it from: https://resend.com/api-keys
- **Important:** The key must have read permissions to retrieve test emails

#### `DATABASE_URL`

PostgreSQL connection string for your test database.

```
postgresql://user:password@host:5432/database
```

- Use a **separate test database** (not production!)
- Can be a free PostgreSQL instance from:
  - [Neon](https://neon.tech)
  - [Supabase](https://supabase.com)
  - [Railway](https://railway.app)

#### `AUTH_SECRET`

Secret key for NextAuth.js authentication.

```bash
# Generate with:
openssl rand -base64 32
```

#### `NEXTAUTH_SECRET`

Same as `AUTH_SECRET` (NextAuth requires both).

#### `PHISHNET_API_KEY` (Optional)

API key for Phish.net to fetch setlist data.

- Get it from: https://api.phish.net/keys

#### `NEON_API_KEY`

API key for Neon database to automatically clean up preview branches.

- Get it from: https://console.neon.tech/app/settings/api-keys
- **Important:** This is used by the database cleanup workflow

#### `NEON_PROJECT_ID`

Your Neon project ID.

- Find it in: https://console.neon.tech/app/projects
- Format: `proj-xxxxx-xxxxxx-xxxxx`

## Workflows

### E2E Tests (`e2e-tests.yml`)

Runs on:

- Every pull request to `main`
- Every push to `main`

What it does:

1. **Checkout code**
2. **Install dependencies**
3. **Install Playwright browsers**
4. **Setup database** (runs Prisma migrations)
5. **Run E2E tests**
6. **Upload artifacts** (if tests fail)

### Database Cleanup (`cleanup-db-branches.yml`)

Runs on:

- When a pull request is closed (merged or closed without merging)

What it does:

1. Automatically deletes the Neon database branch created for the PR preview
2. Helps you stay within Neon's free tier branch limits
3. Prevents "Branch limit reached" errors on Vercel deployments

### Viewing Test Results

When tests fail:

1. Go to the **Actions** tab in your GitHub repository
2. Click on the failed workflow run
3. Scroll to **Artifacts** section at the bottom
4. Download:
   - `playwright-report` - Full HTML report
   - `test-screenshots` - Screenshots of failures

### Test Artifacts

**In CI (enabled):**

- ✅ HTML reports generated
- ✅ Screenshots on failure
- ✅ Traces on first retry
- ✅ Artifacts uploaded to GitHub (30 day retention)

**Locally (disabled):**

- ❌ No HTML reports
- ❌ No screenshots
- ❌ No traces
- ✅ Clean output

## Protecting Your Main Branch

To require tests to pass before merging:

1. Go to **Settings** → **Branches**
2. Add a branch protection rule for `main`:
   - ✅ Require status checks to pass before merging
   - ✅ Require branches to be up to date before merging
   - Select: `test` (the job name from the workflow)
3. Save the rule

Now pull requests **cannot be merged** until tests pass! ✅

## Troubleshooting

### Tests fail in CI but pass locally

- Check that all secrets are set correctly
- Verify the test database is accessible from GitHub Actions
- Check the uploaded screenshots to see what's different

### Database connection fails

- Ensure `DATABASE_URL` secret is set
- Make sure the database allows connections from GitHub's IP ranges
- Consider using a cloud database (Neon, Supabase) that allows external connections

### Rate limiting from Resend

- Tests run sequentially (1 worker) to avoid rate limits
- If you still hit limits, the tests will retry
- Consider upgrading your Resend plan if needed

### Secrets not updating

- After changing a secret, re-run the workflow
- Secrets are only loaded at the start of a workflow run

## Local Testing with CI Settings

To test the CI configuration locally:

```bash
# Run with CI environment variable
CI=true npm test

# This will:
# - Enable screenshots on failure
# - Enable HTML reports
# - Run with 2 retries
```

## Cost Considerations

**GitHub Actions:**

- Free for public repositories
- 2,000 free minutes/month for private repos
- Each test run takes ~2-3 minutes

**Database:**

- Use free tier (Neon, Supabase, Railway)
- Tests create minimal data (~5-10 test users per run)

**Resend:**

- Free tier: 100 emails/day, 3,000/month
- Each test run sends only 1 email (thanks to database test helpers!)
- Monitor your usage at: https://resend.com/dashboard

**Neon:**

- Free tier: 10 database branches
- Database cleanup workflow automatically removes old branches
- Monitor your branches at: https://console.neon.tech
