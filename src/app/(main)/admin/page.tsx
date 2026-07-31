import { auth } from "@/lib/auth"
import { redirect, notFound } from "next/navigation"
import { Metadata } from "next"
import Link from "next/link"
import { BarChart3, Clock, Eye, ChevronRight } from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"

export const metadata: Metadata = {
  title: "Admin",
  robots: {
    index: false,
    follow: false,
  },
}

export default async function AdminHubPage() {
  const session = await auth()
  if (!session?.user?.id) {
    redirect("/login")
  }

  const isAdmin = session.impersonating?.originalIsAdmin ?? session.user.isAdmin
  const isPrivateViewer = session.user.isPrivateViewer

  if (!isAdmin && !isPrivateViewer) {
    notFound()
  }

  const tools = [
    ...(isAdmin
      ? [
          {
            href: "/admin/usage",
            title: "Feature Usage",
            description: "Internal view of who's using what across the app.",
            icon: BarChart3,
          },
          {
            href: "/admin/shows",
            title: "Show Lock Times",
            description:
              "Set a manual pick lock time for a specific show, overriding the standard 7 PM venue-time rule.",
            icon: Clock,
          },
        ]
      : []),
    ...(isPrivateViewer
      ? [
          {
            href: "/submissions",
            title: "Submissions",
            description: "View every submitted pick sheet for the next show.",
            icon: Eye,
          },
        ]
      : []),
  ]

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold font-display text-white">Admin</h1>
        <p className="mt-1 text-gray-400">Tools and internal views.</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        {tools.map((tool) => (
          <Link key={tool.href} href={tool.href}>
            <Card className="h-full transition-colors hover:border-[#5a7b8d]">
              <CardContent className="flex flex-row items-start justify-between gap-4">
                <div className="flex gap-3">
                  <tool.icon className="h-6 w-6 flex-shrink-0 text-gray-400" />
                  <div>
                    <p className="font-semibold text-white">{tool.title}</p>
                    <p className="mt-1 text-sm text-gray-400">
                      {tool.description}
                    </p>
                  </div>
                </div>
                <ChevronRight className="h-5 w-5 flex-shrink-0 text-gray-500" />
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  )
}
