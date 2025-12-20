import { auth } from "@/lib/auth"
import { redirect } from "next/navigation"
import RegisterClient from "./RegisterClient"

export default async function RegisterPage() {
  // Redirect logged-in users to dashboard
  const session = await auth()
  if (session?.user?.id) {
    redirect("/picks")
  }

  return <RegisterClient />
}
