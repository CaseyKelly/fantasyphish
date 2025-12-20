import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { redirect } from "next/navigation"
import { Card } from "@/components/ui/card"
import Link from "next/link"
import { Calendar, MapPin, Target } from "lucide-react"
import { format } from "date-fns"

async function getCompletedShows() {
  const shows = await prisma.show.findMany({
    where: {
      venue: {
        not: {
          contains: "Test Venue",
        },
      },
      isComplete: true,
    },
    orderBy: { showDate: "desc" },
    take: 50,
    select: {
      id: true,
      showDate: true,
      venue: true,
      city: true,
      state: true,
      country: true,
    },
  })
  return shows
}

export default async function TestPickPage() {
  const session = await auth()
  if (!session?.user?.id) {
    redirect("/login")
  }

  if (!session.user.isAdmin) {
    redirect("/dashboard")
  }

  const shows = await getCompletedShows()

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-white">
          Create Test Submission
        </h1>
        <p className="text-slate-400 mt-1">
          Select a completed show to create a test submission with custom picks
        </p>
      </div>

      <div className="space-y-3">
        {shows.map((show) => {
          const showDate = new Date(
            show.showDate.toISOString().split("T")[0] + "T12:00:00.000Z"
          )
          return (
            <Link key={show.id} href={`/pick/test/${show.id}`}>
              <Card className="p-4 hover:bg-slate-700/50 transition-colors cursor-pointer">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-semibold text-white text-lg">
                      {show.venue}
                    </h3>
                    <div className="flex items-center gap-4 text-sm text-slate-400 mt-1">
                      <span className="flex items-center gap-1">
                        <MapPin className="h-4 w-4" />
                        {show.city}, {show.state || show.country}
                      </span>
                      <span className="flex items-center gap-1">
                        <Calendar className="h-4 w-4" />
                        {format(showDate, "MMM d, yyyy")}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 text-blue-400">
                    <Target className="h-5 w-5" />
                    <span className="font-medium">Select Show</span>
                  </div>
                </div>
              </Card>
            </Link>
          )
        })}
      </div>

      {shows.length === 0 && (
        <Card className="p-8 text-center">
          <p className="text-slate-400">
            No completed shows found. Please sync shows first.
          </p>
        </Card>
      )}
    </div>
  )
}
