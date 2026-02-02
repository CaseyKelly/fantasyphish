# Renovate Configuration

FantasyPhish uses Renovate for automated dependency updates.

## Weekly Schedule

Updates run **Monday mornings before 10 AM ET**.

## Automerge Policy

### Automerged Updates

These updates merge automatically after E2E tests pass:

- **Type definitions** (minor/patch) - `@types/*`, `typescript`, `tsx`
- **Linting/formatting tools** (minor/patch) - `eslint`, `prettier`, `lint-staged`, `husky`
- **Build tools** (minor/patch) - `tailwindcss`, `@tailwindcss/postcss`
- **Utility libraries** (patch only) - `date-fns`, `zod`, `bcryptjs`, `lucide-react`, `sonner`
- **Vercel packages** (minor/patch) - `@vercel/analytics`, `@vercel/postgres`
- **GitHub Actions** (minor/patch) - Workflow dependencies
- **Security vulnerabilities** (all) - Immediate patches run anytime
- **Lockfile maintenance** (monthly) - First Monday of each month

### Manual Review Required

These updates always require manual approval:

- **Next.js ecosystem** (all) - `next`, `eslint-config-next` - Critical framework
- **React** (all) - `react`, `react-dom`, `@types/react` - Pinned versions
- **Prisma** (all) - `prisma`, `@prisma/client` - Requires migration review
- **NextAuth** (all) - `next-auth` - Beta package, breaking changes possible
- **Testing tools** (all) - `@playwright/test` - Ensures test compatibility
- **Resend** (all) - `resend` - Email service requires testing
- **Major updates** (all packages) - Breaking changes possible

## Monitoring

**Dependency Dashboard**: Check the pinned GitHub issue titled "Dependency Updates Dashboard" for all pending updates, grouped by category.

## Package Groups

Updates are grouped intelligently:

- **Next.js ecosystem** - Next.js + ESLint config (prevents version mismatches)
- **React** - React + React DOM + types (coordinated updates)
- **Prisma** - Client + CLI (database layer)
- **TypeScript and types** - TypeScript + all type definitions
- **Linting and formatting** - ESLint + Prettier + git hooks
- **Build and CSS** - Tailwind CSS and PostCSS
- **Utilities** - Helper libraries (date-fns, zod, etc.)
- **Vercel** - Vercel-specific packages

## Special Features

### Stability Period

All updates wait **3 days** after a new version is published before creating a PR. This avoids bleeding-edge bugs.

### Security Alerts

Security vulnerability patches run **immediately** (override weekly schedule) and automerge after tests pass.

### Lockfile Maintenance

On the **first Monday of each month**, Renovate updates `package-lock.json` to pull in the latest transitive dependencies.

## Testing Critical Updates

### Prisma Updates

1. Review PR description for schema changes
2. Check migration notes in PR body
3. Test locally:
   ```bash
   npm install
   npm run db:push
   npm test
   ```
4. Run E2E tests: `npm test -- tests/e2e/`
5. Merge only if tests pass

### NextAuth Updates

1. Review beta changelog for breaking changes
2. Test authentication flows:
   - User registration
   - Login/logout
   - Email verification
   - Password reset
3. Check session handling still works
4. Merge only if all auth flows work

### Next.js Updates

1. Review Next.js changelog
2. Test locally: `npm run dev`
3. Check critical pages load correctly
4. Run E2E tests
5. Verify Vercel deployment works

## Troubleshooting

### Too Many PRs

If you're getting overwhelmed with PRs, reduce the concurrent limit:

Edit `renovate.json`:

```json
"prConcurrentLimit": 2  // Down from 3
```

### Updates Too Frequent

Change to monthly updates:

Edit `renovate.json`:

```json
"schedule": ["on the first monday of the month"]
```

### Automerge Not Working

Check the following:

1. Branch protection requires status checks
2. E2E tests are passing
3. Check GitHub App has correct permissions
4. Review Renovate logs in dependency dashboard

### Renovate Not Creating PRs

Possible causes:

1. GitHub App not installed or lacking permissions
2. Review logs in dependency dashboard issue
3. Validate `renovate.json` syntax with `jsonlint`
4. Check schedule hasn't been missed

## Weekly Workflow

**Monday morning:**

1. Check dependency dashboard for new PRs
2. Let automerge handle safe updates (types, linting, utilities)
3. Review critical PRs (Prisma, NextAuth, Next.js, React)
4. Test locally if needed: `npm install` → `npm test`
5. Merge manually reviewed PRs after E2E tests pass

**First Monday of month:**

- Lockfile maintenance PR appears
- Automerges after tests pass
- Updates transitive dependencies

## Configuration

The main configuration is in `renovate.json` at the project root. See comments in the file for details on each rule.

## Rollback

If Renovate causes issues:

1. Disable the Renovate GitHub App (Settings → Integrations)
2. Re-enable Dependabot (Settings → Code security)
3. Keep `renovate.json` for future reference

## Benefits

- **Intelligent grouping** - Related packages updated together
- **Conditional automerge** - Safe updates auto, critical manual
- **Weekly batching** - Reduces notification noise
- **Custom warnings** - Reminds you to test migrations, auth, email
- **Stability period** - Avoids bleeding-edge bugs
- **Security patches** - Immediate fixes for vulnerabilities
- **Central dashboard** - One place to see all updates

## Questions

For questions or issues with Renovate, check the dependency dashboard issue for logs and details.
