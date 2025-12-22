import { auth } from "@/lib/auth"
import { redirect } from "next/navigation"
import RegisterClient from "./RegisterClient"
import { Metadata } from "next"

export const metadata: Metadata = {
  title: "Sign Up",
  description:
    "Create a free FantasyPhish account and start competing in the fantasy game for Phish fans.",
  alternates: {
    canonical: "/register",
  },
  robots: {
    index: true,
    follow: true,
  },
}

export default async function RegisterPage() {
  // Redirect logged-in users to dashboard
  const session = await auth()
  if (session?.user?.id) {
    redirect("/picks")
  }

  return <RegisterClient />
}
