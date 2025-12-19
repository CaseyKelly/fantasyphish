import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { Providers } from "@/components/Providers";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
});

export const metadata: Metadata = {
  title: "FantasyPhish - Predict the Setlist",
  description:
    "Pick 13 songs, score points when they're played. The fantasy game for Phish fans.",
  keywords: ["Phish", "fantasy", "setlist", "music", "game"],
  metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"),
  openGraph: {
    title: "FantasyPhish - Predict the Setlist",
    description:
      "Pick 13 songs, score points when they're played. The fantasy game for Phish fans.",
    type: "website",
    siteName: "FantasyPhish",
  },
  twitter: {
    card: "summary_large_image",
    title: "FantasyPhish - Predict the Setlist",
    description:
      "Pick 13 songs, score points when they're played. The fantasy game for Phish fans.",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${inter.variable} font-sans antialiased bg-slate-900 text-white min-h-screen`}
        suppressHydrationWarning
      >
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
