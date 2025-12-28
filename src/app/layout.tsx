import type { Metadata } from "next"
import { Inter } from "next/font/google"
import { Analytics } from "@vercel/analytics/next"
import "./globals.css"
import { Providers } from "@/components/Providers"

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
})

export const metadata: Metadata = {
  title: {
    default: "FantasyPhish - Predict the Setlist",
    template: "%s | FantasyPhish",
  },
  icons: {
    icon: "/favicon.ico",
  },
  description:
    "Pick 13 songs, score points when they're played. Fantasy Phish - the fantasy game for Phish fans.",
  keywords: [
    "Phish",
    "fantasy",
    "fantasy phish",
    "setlist",
    "music",
    "game",
    "Phish.net",
    "concert",
    "predictions",
    "leaderboard",
    "tour",
    "fantasyphish",
  ],
  authors: [{ name: "FantasyPhish" }],
  creator: "FantasyPhish",
  publisher: "FantasyPhish",
  metadataBase: new URL(
    process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"
  ),
  alternates: {
    canonical: "/",
  },
  openGraph: {
    title: "FantasyPhish - Predict the Setlist",
    description:
      "Pick 13 songs, score points when they're played. The fantasy game for Phish fans.",
    type: "website",
    siteName: "FantasyPhish",
    locale: "en_US",
    images: [
      {
        url: "/opengraph-image",
        width: 1200,
        height: 630,
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "FantasyPhish - Predict the Setlist",
    description:
      "Pick 13 songs, score points when they're played. The fantasy game for Phish fans.",
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-video-preview": -1,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "WebApplication",
    name: "FantasyPhish",
    description:
      "Pick 13 songs, score points when they're played. The fantasy game for Phish fans.",
    url: baseUrl,
    applicationCategory: "Game",
    genre: "Fantasy Sports",
    operatingSystem: "Any",
    offers: {
      "@type": "Offer",
      price: "0",
      priceCurrency: "USD",
    },
  }

  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
      </head>
      <body
        className={`${inter.variable} font-sans antialiased bg-slate-900 text-white min-h-screen`}
        suppressHydrationWarning
      >
        <Providers>{children}</Providers>
        <Analytics />
      </body>
    </html>
  )
}
