import { MetadataRoute } from "next"
import { prisma } from "@/lib/prisma"

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"

  // Get recent completed shows for results pages
  const completedShows = await prisma.show.findMany({
    where: {
      isComplete: true,
    },
    orderBy: {
      showDate: "desc",
    },
    take: 150, // Include last 150 shows for better SEO coverage
    select: {
      id: true,
      updatedAt: true,
    },
  })

  // Get completed tours for leaderboard pages
  const completedTours = await prisma.tour.findMany({
    where: {
      status: { in: ["CLOSED", "COMPLETED"] },
    },
    orderBy: {
      endDate: "desc",
    },
    select: {
      id: true,
      updatedAt: true,
    },
  })

  // Dynamic priorities based on show age
  const now = new Date()
  const showUrls = completedShows.map((show) => {
    const daysSinceUpdate = Math.floor(
      (now.getTime() - show.updatedAt.getTime()) / (1000 * 60 * 60 * 24)
    )

    // Recent shows get higher priority
    let priority = 0.5
    if (daysSinceUpdate < 30) priority = 0.7
    else if (daysSinceUpdate < 90) priority = 0.5
    else priority = 0.3

    return {
      url: `${baseUrl}/results_detail/${show.id}`,
      lastModified: show.updatedAt,
      changeFrequency: "monthly" as const,
      priority,
    }
  })

  const tourUrls = completedTours.map((tour) => ({
    url: `${baseUrl}/leaderboard/${tour.id}`,
    lastModified: tour.updatedAt,
    changeFrequency: "monthly" as const,
    priority: 0.6,
  }))

  return [
    {
      url: baseUrl,
      lastModified: new Date(),
      changeFrequency: "daily",
      priority: 1,
    },
    {
      url: `${baseUrl}/login`,
      lastModified: new Date(),
      changeFrequency: "monthly",
      priority: 0.8,
    },
    {
      url: `${baseUrl}/register`,
      lastModified: new Date(),
      changeFrequency: "monthly",
      priority: 0.8,
    },
    {
      url: `${baseUrl}/leaderboard`,
      lastModified: new Date(),
      changeFrequency: "daily",
      priority: 0.9,
    },
    {
      url: `${baseUrl}/leaderboard/history`,
      lastModified: new Date(),
      changeFrequency: "weekly",
      priority: 0.7,
    },
    ...tourUrls,
    ...showUrls,
  ]
}
