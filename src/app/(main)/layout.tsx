import { redirect } from "next/navigation"
import { auth } from "@/lib/auth"
import { Navbar } from "@/components/Navbar"
import { ImpersonationBanner } from "@/components/ImpersonationBanner"
import { Footer } from "@/components/Footer"

export default async function MainLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const session = await auth()

  // Allow optional authentication for public pages (leaderboard, results_detail)
  // Individual pages handle their own auth requirements if needed

  return (
    <div className="min-h-screen flex flex-col">
      {session && <ImpersonationBanner />}
      <Navbar />
      <main className="w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 flex-1">
        {children}
      </main>
      <Footer />
    </div>
  )
}
