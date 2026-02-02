import { Metadata } from "next"

export const metadata: Metadata = {
  title: "Reset Password",
  description: "Create a new password for your FantasyPhish account.",
  alternates: {
    canonical: "/reset-password",
  },
  robots: {
    index: false,
    follow: false,
  },
}

export default function ResetPasswordLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return children
}
