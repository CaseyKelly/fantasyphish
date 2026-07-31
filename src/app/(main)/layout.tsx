import { redirect } from "next/navigation"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { withRetry } from "@/lib/db-retry"
import { Navbar } from "@/components/Navbar"
import { ImpersonationBanner } from "@/components/ImpersonationBanner"
import { PickReminderBanner } from "@/components/PickReminderBanner"
import { Footer } from "@/components/Footer"

export default async function MainLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const session = await auth()

  // Allow optional authentication for public pages (leaderboard, results_detail)
  // Individual pages handle their own auth requirements if needed

  // Admin-only during initial rollout of the pick reminders feature
  let showReminderBanner = false
  if (session?.user?.isAdmin) {
    const user = await withRetry(
      () =>
        prisma.user.findUnique({
          where: { id: session.user.id },
          select: {
            dismissedRemindersBanner: true,
            emailPickReminders: true,
            _count: { select: { pushSubscriptions: true } },
          },
        }),
      { operationName: "check reminders banner dismissal" }
    )
    const alreadyOptedIn =
      !!user?.emailPickReminders || !!user?._count.pushSubscriptions
    showReminderBanner = !user?.dismissedRemindersBanner && !alreadyOptedIn
  }

  return (
    <div className="min-h-screen flex flex-col">
      {session && <ImpersonationBanner />}
      <Navbar />
      {showReminderBanner && <PickReminderBanner />}
      <main className="w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 flex-1">
        {children}
      </main>
      <Footer showFeedback={!!session} />
    </div>
  )
}
