import { Metadata } from "next"

export const metadata: Metadata = {
  title: "Picks",
  description:
    "Make your song picks for upcoming Phish shows and compete on the tour leaderboard.",
  openGraph: {
    title: "Picks | FantasyPhish",
    description:
      "Make your song picks for upcoming Phish shows and compete on the tour leaderboard.",
  },
  alternates: {
    canonical: "/picks",
  },
}

export default function PicksLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return children
}
