import { Metadata } from "next"

export const metadata: Metadata = {
  title: "Test Submissions",
  description: "Admin page for testing submissions on completed shows.",
  alternates: {
    canonical: "/pick/test",
  },
  robots: {
    index: false,
    follow: false,
  },
}

export default function TestPicksLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return children
}
