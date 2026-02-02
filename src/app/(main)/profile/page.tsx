import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { redirect } from "next/navigation"
import { Metadata } from "next"

export const metadata: Metadata = {
  title: "Profile",
  description: "View your FantasyPhish profile, achievements, and stats.",
  openGraph: {
    title: "Profile | FantasyPhish",
    description: "View your FantasyPhish profile, achievements, and stats.",
  },
  alternates: {
    canonical: "/profile",
  },
}

export default async function ProfilePage() {
  const session = await auth()
  if (!session?.user?.id) {
    redirect("/login")
  }

  // Get user's username to redirect to their profile
  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { username: true },
  })

  if (!user) {
    redirect("/login")
  }

  // Redirect to user's public profile
  redirect(`/user/${user.username}`)
}
