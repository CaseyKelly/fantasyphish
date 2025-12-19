import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { compare } from "bcryptjs";
import { prisma } from "./prisma";

const authSecret = process.env.AUTH_SECRET || process.env.NEXTAUTH_SECRET;

if (!authSecret) {
  console.error("AUTH_SECRET is not set in environment variables");
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
          return null;
        }

        const email = credentials.email as string;
        const password = credentials.password as string;

        const user = await prisma.user.findUnique({
          where: { email: email.toLowerCase() },
        });

        if (!user) {
          return null;
        }

        if (!user.emailVerified) {
          return null;
        }

        const isPasswordValid = await compare(password, user.passwordHash);

        if (!isPasswordValid) {
          return null;
        }

        return {
          id: user.id,
          email: user.email,
          username: user.username,
        };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.username = user.username;
      }
      return token;
    },
    async session({ session, token }) {
      if (token && session.user) {
        session.user.id = token.id as string;
        session.user.username = token.username as string;
      }
      return session;
    },
  },
  pages: {
    signIn: "/login",
  },
  session: {
    strategy: "jwt",
  },
  debug: process.env.NODE_ENV === "development",
});
