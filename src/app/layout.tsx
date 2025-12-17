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
  openGraph: {
    title: "FantasyPhish - Predict the Setlist",
    description:
      "Pick 13 songs, score points when they're played. The fantasy game for Phish fans.",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <body
        className={`${inter.variable} font-sans antialiased bg-slate-900 text-white min-h-screen`}
      >
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
