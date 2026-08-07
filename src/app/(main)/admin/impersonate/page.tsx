import { auth } from "@/lib/auth"
import { redirect, notFound } from "next/navigation"
import { Metadata } from "next"
import Link from "next/link"
import { ArrowLeft } from "lucide-react"
import ImpersonateClient from "./ImpersonateClient"

export const metadata: Metadata = {
  title: "Impersonate User",
  robots: {
    index: false,
    follow: false,
  },
}

export default async function AdminImpersonatePage() {
  const session = await auth()
  if (!session?.user?.id) {
    redirect("/login")
  }

  const isAdmin = session.impersonating?.originalIsAdmin ?? session.user.isAdmin
  if (!isAdmin) {
    notFound()
  }

  return (
    <div className="space-y-8">
      <div>
        <Link
          href="/admin"
          className="inline-flex items-center gap-1 text-sm text-gray-400 hover:text-white"
        >
          <ArrowLeft className="h-4 w-4" />
          Admin
        </Link>
        <h1 className="mt-2 text-3xl font-bold font-display text-white">
          Impersonate User
        </h1>
        <p className="mt-1 text-gray-400">
          View the app as another user for debugging or support. You&apos;ll
          stay impersonated until you sign out or stop impersonating from the
          banner.
        </p>
      </div>

      <ImpersonateClient />
    </div>
  )
}
