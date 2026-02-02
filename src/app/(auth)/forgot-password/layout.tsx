import { Metadata } from "next"

export const metadata: Metadata = {
  title: "Forgot Password",
  description: "Reset your FantasyPhish password.",
  alternates: {
    canonical: "/forgot-password",
  },
  robots: {
    index: false,
    follow: false,
  },
}

export default function ForgotPasswordLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return children
}
