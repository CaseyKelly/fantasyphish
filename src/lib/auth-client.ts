"use client"

import { signIn } from "next-auth/react"

// A transient NextAuth CSRF race (a known, documented Auth.js issue - see
// nextauthjs/next-auth #11336, #11337, #11713, #11726 - associated with
// custom sign-in pages, which this app uses via `pages: { signIn: "/login" }`
// in src/lib/auth.ts) can occasionally fail a signIn() call even with
// correct credentials - either as a returned `error`, or as a thrown/
// rejected call. One immediate retry clears it without misleading the user
// into thinking their password was wrong.
export async function signInWithRetry(
  email: string,
  password: string
): Promise<Awaited<ReturnType<typeof signIn>>> {
  const attempt = () =>
    signIn("credentials", { email, password, redirect: false })
  try {
    const first = await attempt()
    if (!first?.error) return first
  } catch {
    // fall through to the retry below
  }
  return attempt()
}
