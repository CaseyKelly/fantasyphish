import { auth } from "@/lib/auth"
import { redirect } from "next/navigation"
import LoginClient from "./LoginClient"
import { Metadata } from "next"

export const metadata: Metadata = {
  title: "Log In",
  description: "Log in to FantasyPhish and make your picks for the next show.",
  alternates: {
    canonical: "/login",
  },
  robots: {
    index: true,
    follow: true,
  },
}

export default async function LoginPage() {
  // Redirect logged-in users to dashboard
  const session = await auth()
  if (session?.user?.id) {
    redirect("/picks")
  }

  return <LoginClient />
}
