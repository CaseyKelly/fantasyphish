import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getUpcomingShows } from "@/lib/phishnet";
import { format, isPast, isToday } from "date-fns";
import Link from "next/link";
import {
  Calendar,
  MapPin,
  ChevronRight,
  Trophy,
  Target,
  CheckCircle,
  Clock,
} from "lucide-react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

async function getShowsAndSubmissions(userId: string) {
  // Fetch upcoming shows from phish.net
  const upcomingShows = await getUpcomingShows();

  // Sync shows to database
  for (const show of upcomingShows) {
    const showDate = new Date(show.showdate);
    await prisma.show.upsert({
      where: { showDate },
      create: {
        showDate,
        venue: show.venue,
        city: show.city,
        state: show.state,
        country: show.country,
      },
      update: {
        venue: show.venue,
        city: show.city,
        state: show.state,
        country: show.country,
      },
    });
  }

  // Get shows with user's submissions
  const shows = await prisma.show.findMany({
    where: {
      showDate: {
        gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), // Last 30 days
      },
    },
    include: {
      submissions: {
        where: { userId },
        include: {
          picks: true,
        },
      },
    },
    orderBy: { showDate: "asc" },
  });

  return shows;
}

async function getUserStats(userId: string) {
  const stats = await prisma.submission.aggregate({
    where: {
      userId,
      isScored: true,
    },
    _sum: { totalPoints: true },
    _count: true,
  });

  return {
    totalPoints: stats._sum.totalPoints || 0,
    showsPlayed: stats._count,
  };
}

export default async function DashboardPage() {
  const session = await auth();
  if (!session?.user?.id) return null;

  const [shows, stats] = await Promise.all([
    getShowsAndSubmissions(session.user.id),
    getUserStats(session.user.id),
  ]);

  const upcomingShows = shows.filter(
    (show) => !isPast(show.showDate) || isToday(show.showDate)
  );
  const recentShows = shows
    .filter((show) => isPast(show.showDate) && !isToday(show.showDate))
    .slice(0, 5);

  return (
    <div className="space-y-8">
      {/* Welcome Header */}
      <div>
        <h1 className="text-3xl font-bold text-white">Dashboard</h1>
        <p className="text-gray-400 mt-1">
          Welcome back! Pick your songs for the next show.
        </p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center space-x-3">
              <div className="p-2 bg-[#c23a3a]/20 rounded-lg">
                <Trophy className="h-5 w-5 text-[#c23a3a]" />
              </div>
              <div>
                <p className="text-2xl font-bold text-white">
                  {stats.totalPoints}
                </p>
                <p className="text-sm text-gray-400">Total Points</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center space-x-3">
              <div className="p-2 bg-[#3d5a6c] rounded-lg">
                <Target className="h-5 w-5 text-white" />
              </div>
              <div>
                <p className="text-2xl font-bold text-white">
                  {stats.showsPlayed}
                </p>
                <p className="text-sm text-gray-400">Shows Played</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center space-x-3">
              <div className="p-2 bg-green-500/20 rounded-lg">
                <CheckCircle className="h-5 w-5 text-green-500" />
              </div>
              <div>
                <p className="text-2xl font-bold text-white">
                  {stats.showsPlayed > 0
                    ? Math.round(stats.totalPoints / stats.showsPlayed)
                    : 0}
                </p>
                <p className="text-sm text-gray-400">Avg Points</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center space-x-3">
              <div className="p-2 bg-[#3d5a6c] rounded-lg">
                <Calendar className="h-5 w-5 text-white" />
              </div>
              <div>
                <p className="text-2xl font-bold text-white">
                  {upcomingShows.length}
                </p>
                <p className="text-sm text-gray-400">Upcoming Shows</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Upcoming Shows */}
      <div>
        <h2 className="text-xl font-semibold text-white mb-4">
          Upcoming Shows
        </h2>

        {upcomingShows.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <Calendar className="h-12 w-12 text-gray-500 mx-auto mb-4" />
              <p className="text-gray-400">
                No upcoming shows scheduled. Check back later!
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            {upcomingShows.map((show) => {
              const hasSubmission = show.submissions.length > 0;
              const isShowToday = isToday(show.showDate);

              return (
                <Card
                  key={show.id}
                  className={isShowToday ? "ring-2 ring-[#c23a3a]/50" : ""}
                >
                  <CardContent className="py-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-4">
                        <div className="hidden sm:flex flex-col items-center justify-center w-16 h-16 bg-[#3d5a6c] rounded-lg">
                          <span className="text-2xl font-bold text-white">
                            {format(show.showDate, "d")}
                          </span>
                          <span className="text-xs text-gray-300 uppercase">
                            {format(show.showDate, "MMM")}
                          </span>
                        </div>
                        <div>
                          <div className="flex items-center space-x-2">
                            <h3 className="font-semibold text-white">
                              {show.venue}
                            </h3>
                            {isShowToday && (
                              <span className="px-2 py-0.5 text-xs font-medium bg-[#c23a3a]/20 text-[#d64545] rounded-full">
                                Tonight!
                              </span>
                            )}
                          </div>
                          <div className="flex items-center space-x-4 text-sm text-gray-400 mt-1">
                            <span className="flex items-center">
                              <MapPin className="h-4 w-4 mr-1" />
                              {show.city}, {show.state || show.country}
                            </span>
                            <span className="flex items-center sm:hidden">
                              <Calendar className="h-4 w-4 mr-1" />
                              {format(show.showDate, "MMM d")}
                            </span>
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center space-x-3">
                        {hasSubmission ? (
                          <div className="flex items-center space-x-2">
                            <span className="hidden sm:inline-flex items-center px-3 py-1 bg-green-500/20 text-green-400 rounded-full text-sm">
                              <CheckCircle className="h-4 w-4 mr-1" />
                              Picks submitted
                            </span>
                            <Link href={`/pick/${show.id}`}>
                              <Button variant="outline" size="sm">
                                Edit
                              </Button>
                            </Link>
                          </div>
                        ) : (
                          <Link href={`/pick/${show.id}`}>
                            <Button size="sm">
                              Make Picks
                              <ChevronRight className="h-4 w-4 ml-1" />
                            </Button>
                          </Link>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>

      {/* Recent Shows */}
      {recentShows.length > 0 && (
        <div>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-semibold text-white">Recent Shows</h2>
            <Link
              href="/history"
              className="text-sm text-[#c23a3a] hover:text-[#d64545]"
            >
              View all
            </Link>
          </div>

          <div className="space-y-3">
            {recentShows.map((show) => {
              const submission = show.submissions[0];

              return (
                <Card key={show.id}>
                  <CardContent className="py-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-4">
                        <div className="hidden sm:flex flex-col items-center justify-center w-12 h-12 bg-[#3d5a6c] rounded-lg">
                          <span className="text-lg font-bold text-white">
                            {format(show.showDate, "d")}
                          </span>
                          <span className="text-xs text-gray-300 uppercase">
                            {format(show.showDate, "MMM")}
                          </span>
                        </div>
                        <div>
                          <h3 className="font-medium text-white">
                            {show.venue}
                          </h3>
                          <p className="text-sm text-gray-400">
                            {show.city}, {show.state || show.country}
                          </p>
                        </div>
                      </div>

                      <div className="text-right">
                        {submission ? (
                          submission.isScored ? (
                            <div>
                              <p className="text-2xl font-bold text-[#c23a3a]">
                                {submission.totalPoints}
                              </p>
                              <p className="text-xs text-gray-400">points</p>
                            </div>
                          ) : (
                            <span className="flex items-center text-sm text-gray-400">
                              <Clock className="h-4 w-4 mr-1" />
                              Scoring...
                            </span>
                          )
                        ) : (
                          <span className="text-sm text-gray-500">
                            No picks
                          </span>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
