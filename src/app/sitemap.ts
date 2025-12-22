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
    take: 50, // Include last 50 shows
    select: {
      id: true,
      updatedAt: true,
    },
  })

  const showUrls = completedShows.map((show) => ({
    url: `${baseUrl}/results_detail/${show.id}`,
    lastModified: show.updatedAt,
    changeFrequency: "monthly" as const,
    priority: 0.5,
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
    ...showUrls,
  ]
}
