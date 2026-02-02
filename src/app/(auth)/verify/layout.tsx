import { Metadata } from "next"

export const metadata: Metadata = {
  title: "Verify Email",
  description:
    "Verify your email address to complete your FantasyPhish registration.",
  alternates: {
    canonical: "/verify",
  },
  robots: {
    index: false,
    follow: false,
  },
}

export default function VerifyLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return children
}
