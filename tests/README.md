# E2E Testing with Playwright

This directory contains end-to-end tests for FantasyPhish using Playwright and Resend's test email infrastructure.

## Overview

The test suite validates the complete authentication flow including:

- User registration with email verification
- Email delivery and content validation
- Login with verified credentials
- Edge cases (expired tokens, duplicate users, validation errors)

## Setup

### 1. Install Playwright browsers

```bash
npx playwright install
```

### 2. Configure environment variables

Make sure your `.env.local` file contains:

```bash
# Required for sending and retrieving test emails
RESEND_API_KEY=re_your_api_key_here

# Required for authentication
AUTH_SECRET=your-auth-secret

# App URL (defaults to http://localhost:3000)
NEXT_PUBLIC_APP_URL=http://localhost:3000

# Database connection
DATABASE_URL=your-database-url
```

### 3. Set up test database

Ensure your database is accessible and has the latest schema:

```bash
npm run db:push
```

## Running Tests

### Run all tests (headless)

```bash
npm test
```

### Run tests with UI mode (recommended for development)

```bash
npm run test:ui
```

### Run tests in headed mode (see the browser)

```bash
npm run test:headed
```

### Run tests in debug mode

```bash
npm run test:debug
```

### Run specific test file

```bash
npx playwright test tests/e2e/auth.spec.ts
```

### Run specific test by name

```bash
npx playwright test -g "should complete full registration flow"
```

## How Email Testing Works

### Resend Test Email Addresses

The tests use Resend's special test email addresses that:

- Don't require a real inbox
- Can be retrieved via Resend's API
- Support different delivery scenarios

Test email formats:

- `delivered+label-timestamp@resend.dev` - Successfully delivered
- `bounce+label-timestamp@resend.dev` - Simulates bounce
- `complaint+label-timestamp@resend.dev` - Simulates spam complaint

### Email Verification Flow

1. Test registers a user with `delivered+...@resend.dev` email
2. Application sends verification email via Resend
3. Test polls Resend API to retrieve the email
4. Test extracts the verification token from email HTML
5. Test visits the verification URL with the token
6. Test validates successful verification and login

### Email Helper Functions

Located in `tests/e2e/helpers/email.ts`:

- `generateTestEmail(label)` - Creates unique test email address
- `waitForEmail(toEmail, options)` - Polls for email delivery
- `extractVerificationToken(html)` - Extracts token from email HTML
- `extractUrlFromEmail(html, pattern)` - Extracts URLs from email

## Test Structure

### Fixtures (`tests/e2e/helpers/fixtures.ts`)

Custom test fixtures that extend Playwright's base test:

- `prisma` - Provides Prisma client for database operations
- `cleanupEmail(email)` - Automatically removes test users after each test

Usage:

```typescript
test("my test", async ({ page, cleanupEmail, prisma }) => {
  const email = generateTestEmail("my-test")
  await cleanupEmail(email) // Register for cleanup

  // Test code...

  // User is automatically deleted after test
})
```

### Test Organization

- `auth.spec.ts` - Authentication flow tests
  - Full registration with email verification
  - Login with verified credentials
  - Unverified email rejection
  - Invalid token handling
  - Duplicate user/email validation
  - Form validation (email, password, username)
  - Token expiry and reuse prevention

## Writing New Tests

### Example: Testing a new feature

```typescript
import { test, expect } from "./helpers/fixtures"
import { generateTestEmail, waitForEmail } from "./helpers/email"

test("should do something", async ({ page, cleanupEmail }) => {
  const email = generateTestEmail("feature-test")
  await cleanupEmail(email)

  // Your test code here
  await page.goto("/my-page")
  // ...
})
```

### Best Practices

1. **Always use `cleanupEmail()`** for any user you create
2. **Use unique labels** in `generateTestEmail()` to identify tests
3. **Set appropriate timeouts** when waiting for emails (default: 30s)
4. **Test email content** to catch rendering issues
5. **Test error cases** not just happy paths
6. **Use descriptive test names** that explain what is being tested

## Debugging

### View test results

```bash
npx playwright show-report
```

### Debug specific test

```bash
npx playwright test --debug -g "test name"
```

### Inspect email content

The `waitForEmail()` function returns the full email object including HTML:

```typescript
const email = await waitForEmail(testEmail)
console.log("Email HTML:", email.html)
console.log("Email subject:", email.subject)
```

### Check database state

Use the `prisma` fixture to inspect database:

```typescript
test("my test", async ({ prisma }) => {
  const user = await prisma.user.findUnique({
    where: { email: "test@resend.dev" },
  })
  console.log("User:", user)
})
```

## CI/CD Integration

The tests are configured to work in CI environments:

- `CI=true` enables stricter settings (retries, single worker)
- Tests will fail if `.only` is used
- HTML report is generated automatically

### GitHub Actions Example

```yaml
- name: Install dependencies
  run: npm ci

- name: Install Playwright browsers
  run: npx playwright install --with-deps

- name: Run tests
  run: npm test
  env:
    CI: true
    RESEND_API_KEY: ${{ secrets.RESEND_API_KEY }}
    DATABASE_URL: ${{ secrets.DATABASE_URL }}
    AUTH_SECRET: ${{ secrets.AUTH_SECRET }}
```

## Troubleshooting

### Email not received

- Check RESEND_API_KEY is set correctly
- Verify you're using `@resend.dev` test emails
- Increase timeout in `waitForEmail({ timeout: 60000 })`
- Check Resend dashboard for delivery status

### Database connection errors

- Ensure DATABASE_URL is set
- Run `npm run db:push` to update schema
- Check database is accessible from test environment

### Tests timing out

- The dev server needs to be running (configured in playwright.config.ts)
- Increase timeout if needed for slow environments
- Check network connectivity

### Browser not launching

- Run `npx playwright install` to install browsers
- Check system dependencies with `npx playwright install --with-deps`
