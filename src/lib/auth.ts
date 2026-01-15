import NextAuth from "next-auth"
import Credentials from "next-auth/providers/credentials"
import { compare } from "bcryptjs"
import { prisma } from "./prisma"

const authSecret = process.env.AUTH_SECRET || process.env.NEXTAUTH_SECRET

if (!authSecret) {
  throw new Error(
    "AUTH_SECRET is not set in environment variables. Please set AUTH_SECRET in your .env.local file."
  )
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
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          return null
        }

        const email = credentials.email as string
        const password = credentials.password as string

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
