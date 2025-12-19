# Agent Guidelines

## Build & Test Commands

- **Build:** `npm run build` (includes prisma generate)
- **Lint:** `npm run lint`
- **Typecheck:** `npm run typecheck`
- **All tests:** `npm test`
- **Single test:** `npm test -- tests/e2e/auth.spec.ts` or `npm test -- -g "test name"`
- **Debug test:** `npm run test:debug`
- **Database:** `npm run db:push` (sync schema), `npm run db:migrate` (migrations)

## Code Style

- **TypeScript:** Strict mode enabled. Use explicit types for function params and returns.
- **Imports:** Use `@/*` path alias for src/ imports (e.g., `import { auth } from "@/lib/auth"`).
- **Formatting:** 2-space indent. Double quotes for strings. Omit semicolons in TypeScript and JavaScript files.
- **Components:** React functional components with "use client" directive for client components.
- **Naming:** camelCase for functions/variables, PascalCase for components/types, SCREAMING_SNAKE for enums.
- **Error handling:** API routes return `NextResponse.json({ error: "message" }, { status: code })`. Use try/catch with console.error for logging.
- **Validation:** Use Zod schemas for API request validation.
- **Framework:** Next.js 16 App Router, NextAuth v5, Prisma ORM, Tailwind CSS v4.
