import type { Metadata } from "next"
import { Inter } from "next/font/google"
import { Analytics } from "@vercel/analytics/next"
import "./globals.css"
import { Providers } from "@/components/Providers"

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
  preload: true,
})

export const metadata: Metadata = {
  title: {
    default: "Fantasy Phish - FantasyPhish | Predict the Setlist",
    template: "%s | FantasyPhish",
  },
  description:
    "Fantasy Phish is the ultimate prediction game for Phish fans. Pick 13 songs before showtime, score points when they're played, and compete on the leaderboard.",
  keywords: [
    "fantasy phish",
    "FantasyPhish",
    "Phish",
    "fantasy",
    "phish fantasy game",
    "phish prediction game",
    "phish setlist game",
    "setlist",
    "setlist predictions",
    "music",
    "game",
    "Phish.net",
    "concert",
    "predictions",
    "leaderboard",
    "tour",
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
  icons: {
    icon: [
      { url: "/favicon.ico", sizes: "32x32" },
      { url: "/favicon-16x16.png", sizes: "16x16", type: "image/png" },
      { url: "/favicon-32x32.png", sizes: "32x32", type: "image/png" },
      {
        url: "/android-chrome-192x192.png",
        sizes: "192x192",
        type: "image/png",
      },
      {
        url: "/android-chrome-512x512.png",
        sizes: "512x512",
        type: "image/png",
      },
    ],
    apple: [
      { url: "/apple-touch-icon.png", sizes: "180x180", type: "image/png" },
    ],
  },
  manifest: "/manifest.json",
  openGraph: {
    title: "Fantasy Phish - FantasyPhish | Predict the Setlist",
    description:
      "Fantasy Phish is the ultimate prediction game for Phish fans. Pick 13 songs before showtime, score points when they're played, and compete on the leaderboard.",
    type: "website",
    siteName: "FantasyPhish",
    locale: "en_US",
  },
  twitter: {
    card: "summary_large_image",
    title: "Fantasy Phish - FantasyPhish | Predict the Setlist",
    description:
      "Fantasy Phish is the ultimate prediction game for Phish fans. Pick 13 songs before showtime, score points when they're played, and compete on the leaderboard.",
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
    alternateName: "Fantasy Phish",
    description:
      "Fantasy Phish is the ultimate prediction game for Phish fans. Pick 13 songs before showtime, score points when they're played, and compete on the leaderboard.",
    url: baseUrl,
    applicationCategory: "Game",
    genre: "Fantasy Sports",
    operatingSystem: "Any",
    about: {
      "@type": "Thing",
      name: "Phish Setlist Prediction",
      description:
        "A fantasy game where players predict which songs Phish will play at upcoming concerts",
    },
    offers: {
      "@type": "Offer",
      price: "0",
      priceCurrency: "USD",
    },
  }

  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <link rel="dns-prefetch" href="https://phish.net" />
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
        {process.env.NODE_ENV === "production" && <Analytics />}
      </body>
    </html>
  )
}
