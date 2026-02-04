import { redirect } from "next/navigation"
import { auth } from "@/lib/auth"
import { isAdminFeaturesEnabled } from "@/lib/env"
import { PushNotificationsPanel } from "@/components/admin/PushNotificationsPanel"
import { UserManagementPanel } from "@/components/admin/UserManagementPanel"

export default async function AdminPage() {
  const session = await auth()

  if (!session?.user?.isAdmin || !isAdminFeaturesEnabled()) {
    redirect("/")
  }

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">Admin Panel</h1>
        <div className="text-sm text-neutral-400">
          Logged in as{" "}
          <span className="font-semibold text-accent">
            {session.user.username}
          </span>
        </div>
      </div>

      <div className="grid gap-8">
        <PushNotificationsPanel />
        <UserManagementPanel />
      </div>
    </div>
  )
}
