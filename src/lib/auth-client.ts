"use client"

import { signIn } from "next-auth/react"

// A transient NextAuth CSRF race (a known, documented Auth.js issue - see
// nextauthjs/next-auth #11336, #11337, #11713, #11726 - associated with
// custom sign-in pages, which this app uses via `pages: { signIn: "/login" }`
// in src/lib/auth.ts) can occasionally fail a signIn() call even with
// correct credentials. One immediate retry clears it without misleading the
// user into thinking their password was wrong.
export async function signInWithRetry(email: string, password: string) {
  const attempt = () =>
    signIn("credentials", { email, password, redirect: false })
  const first = await attempt()
  return first?.error ? attempt() : first
}
