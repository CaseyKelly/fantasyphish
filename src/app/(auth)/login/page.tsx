import { auth } from "@/lib/auth"
import { redirect } from "next/navigation"
import LoginClient from "./LoginClient"

export default async function LoginPage() {
  // Redirect logged-in users to dashboard
  const session = await auth()
  if (session?.user?.id) {
    redirect("/picks")
  }

  return <LoginClient />
}
