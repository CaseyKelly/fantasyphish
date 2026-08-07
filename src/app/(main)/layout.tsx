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
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-[100] focus:px-4 focus:py-2 focus:rounded-lg focus:bg-[#c23a3a] focus:text-white"
      >
        Skip to main content
      </a>
      {session && <ImpersonationBanner />}
      <Navbar />
      <main
        id="main-content"
        className="w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 flex-1"
      >
        {children}
      </main>
      <Footer showFeedback={!!session} />
    </div>
  )
}
