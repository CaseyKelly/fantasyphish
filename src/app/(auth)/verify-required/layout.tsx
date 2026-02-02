import { Metadata } from "next"

export const metadata: Metadata = {
  title: "Email Verification Required",
  description: "Please verify your email address to access FantasyPhish.",
  alternates: {
    canonical: "/verify-required",
  },
  robots: {
    index: false,
    follow: false,
  },
}

export default function VerifyRequiredLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return children
}
