import { auth } from "@/lib/auth"
import { redirect } from "next/navigation"
import { HomeClient } from "./HomeClient"
import { Metadata } from "next"

export const metadata: Metadata = {
  alternates: {
    canonical: "/",
  },
}

export default async function LandingPage() {
  // Redirect logged-in users to dashboard
  const session = await auth()
  if (session?.user?.id) {
    redirect("/picks")
  }
  return <HomeClient />
}
