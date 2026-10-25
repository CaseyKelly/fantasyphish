import NextAuth, { CredentialsSignin } from "next-auth"
import Credentials from "next-auth/providers/credentials"
import { compare } from "bcryptjs"
import { prisma } from "./prisma"
import { isPrivateViewerOwner } from "./private-access"
import {
  RATE_LIMITS,
  checkRateLimits,
  getClientIp,
  normalizeEmailKey,
} from "./rate-limit"
import { RATE_LIMITED_CODE } from "./auth-errors"

// Throwing a CredentialsSignin subclass is how NextAuth v5 fails a sign-in
// with a custom `code`, which signIn({ redirect: false }) hands back to the
// login page so it can show a specific message.
class RateLimitedSignin extends CredentialsSignin {
  code = RATE_LIMITED_CODE
}

const authSecret = process.env.AUTH_SECRET || process.env.NEXTAUTH_SECRET

if (!authSecret) {
  console.error("AUTH_SECRET is not set in environment variables")
}

export const { handlers, signIn, signOut, auth } = NextAuth({
  secret: authSecret,
  providers: [
    Credentials({
      name: "credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials, request) {
        if (!credentials?.email || !credentials?.password) {
          return null
        }

        const email = credentials.email as string
        const password = credentials.password as string

        // Per-email stops guessing one account's password; the looser
        // per-IP limit stops one client spraying many accounts. Skip the IP
        // check if NextAuth didn't pass the request, rather than lumping
        // every caller into one shared "unknown" bucket.
        const rateLimit = await checkRateLimits(
          request?.headers
            ? [
                [RATE_LIMITS.loginIp, getClientIp(request.headers)],
                [RATE_LIMITS.loginEmail, normalizeEmailKey(email)],
              ]
            : [[RATE_LIMITS.loginEmail, normalizeEmailKey(email)]]
        )
        if (!rateLimit.allowed) {
          throw new RateLimitedSignin()
        }

        const user = await prisma.user.findUnique({
          where: { email: email.toLowerCase() },
        })

        if (!user) {
          return null
        }

        if (!user.emailVerified) {
          return null
        }

        const isPasswordValid = await compare(password, user.passwordHash)

        if (!isPasswordValid) {
          return null
        }

        return {
          id: user.id,
          email: user.email,
          username: user.username,
          isAdmin: user.isAdmin,
          isPrivateViewer: isPrivateViewerOwner(user.email),
        }
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user, trigger, session }) {
      if (user) {
        token.id = user.id
        token.username = user.username
        token.isAdmin = user.isAdmin
        token.isPrivateViewer = user.isPrivateViewer
      }

      // Handle impersonation updates from session update
      if (trigger === "update" && session) {
        const updateSession = session as {
          impersonating?: {
            originalUserId: string
            originalUsername: string
            originalIsAdmin: boolean
            targetUserId: string
            targetUsername: string
            targetEmail: string
            targetIsAdmin: boolean
          }
          stopImpersonating?: boolean
        }

        if (updateSession.impersonating) {
          // Store original user info
          token.impersonating = {
            originalUserId: updateSession.impersonating.originalUserId,
            originalUsername: updateSession.impersonating.originalUsername,
            originalIsAdmin: updateSession.impersonating.originalIsAdmin,
          }
          // Switch to target user
          token.id = updateSession.impersonating.targetUserId
          token.username = updateSession.impersonating.targetUsername
          token.isAdmin = updateSession.impersonating.targetIsAdmin
        } else if (updateSession.stopImpersonating) {
          // Restore original user
          const impersonation = token.impersonating as
            | {
                originalUserId: string
                originalUsername: string
                originalIsAdmin: boolean
              }
            | undefined
          if (impersonation) {
            token.id = impersonation.originalUserId
            token.username = impersonation.originalUsername
            token.isAdmin = impersonation.originalIsAdmin
            delete token.impersonating
          }
        }
      }

      return token
    },
    async session({ session, token }) {
      if (token && session.user) {
        session.user.id = token.id as string
        session.user.username = token.username as string
        session.user.isAdmin = token.isAdmin as boolean
        session.user.isPrivateViewer = token.isPrivateViewer as boolean

        const impersonation = token.impersonating as
          | {
              originalUserId: string
              originalUsername: string
              originalIsAdmin: boolean
            }
          | undefined
        if (impersonation) {
          session.impersonating = impersonation
        }
      }
      return session
    },
  },
  pages: {
    signIn: "/login",
  },
  session: {
    strategy: "jwt",
  },
  debug: process.env.NODE_ENV === "development",
})
