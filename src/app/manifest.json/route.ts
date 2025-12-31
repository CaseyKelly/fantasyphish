import { NextResponse } from "next/server"

export async function GET() {
  const manifest = {
    name: "Fantasy Phish - FantasyPhish",
    short_name: "FantasyPhish",
    description:
      "Fantasy Phish is the ultimate prediction game for Phish fans. Pick 13 songs before showtime, score points when they're played, and compete on the leaderboard.",
    start_url: "/",
    display: "standalone",
    background_color: "#0f172a",
    theme_color: "#2d4654",
    orientation: "portrait-primary",
    icons: [
      {
        src: "/favicon-16x16.png",
        sizes: "16x16",
        type: "image/png",
      },
      {
        src: "/favicon-32x32.png",
        sizes: "32x32",
        type: "image/png",
      },
      {
        src: "/android-chrome-192x192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "any maskable",
      },
      {
        src: "/android-chrome-512x512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "any maskable",
      },
    ],
    categories: ["entertainment", "games", "music"],
  }

  return NextResponse.json(manifest, {
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "public, max-age=3600, s-maxage=3600",
    },
  })
}
