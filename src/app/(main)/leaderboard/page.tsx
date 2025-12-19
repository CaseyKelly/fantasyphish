import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { Trophy, Medal, User, TrendingUp } from "lucide-react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";

interface LeaderboardPageProps {
  searchParams: Promise<{ tourId?: string }>;
}

async function getLeaderboard(tourId?: string) {
  const whereClause = tourId
    ? {
        isScored: true,
        show: { tourId },
      }
    : { isScored: true };

  const users = await prisma.user.findMany({
    where: {
      submissions: {
        some: whereClause,
      },
    },
    select: {
      id: true,
      username: true,
      submissions: {
        where: whereClause,
        select: {
          totalPoints: true,
          picks: {
            select: {
              wasPlayed: true,
            },
          },
        },
      },
    },
  });

  const rankedUsers = users
    .map((user) => {
      const totalPoints = user.submissions.reduce(
        (sum, sub) => sum + (sub.totalPoints || 0),
        0
      );
      const totalPicks = user.submissions.length * 13;
      const correctPicks = user.submissions.reduce(
        (sum, sub) => sum + sub.picks.filter((p) => p.wasPlayed).length,
        0
      );

      return {
        userId: user.id,
        username: user.username,
        totalPoints,
        showsPlayed: user.submissions.length,
        avgPoints:
          user.submissions.length > 0
            ? Math.round((totalPoints / user.submissions.length) * 10) / 10
            : 0,
        accuracy: totalPicks > 0 ? Math.round((correctPicks / totalPicks) * 100) : 0,
      };
    })
    .sort((a, b) => b.totalPoints - a.totalPoints)
    .map((user, index) => ({
      ...user,
      rank: index + 1,
    }));

  return rankedUsers;
}

export default async function LeaderboardPage({
  searchParams,
}: LeaderboardPageProps) {
  const session = await auth();
  const params = await searchParams;
  const tourId = params.tourId;

  const leaderboard = await getLeaderboard(tourId);

  const currentUserRank = session?.user?.id
    ? leaderboard.find((u) => u.userId === session.user.id)
    : null;

  const getRankIcon = (rank: number) => {
    switch (rank) {
      case 1:
        return <Trophy className="h-6 w-6 text-yellow-500" />;
      case 2:
        return <Medal className="h-6 w-6 text-gray-400" />;
      case 3:
        return <Medal className="h-6 w-6 text-amber-600" />;
      default:
        return (
          <span className="w-6 h-6 flex items-center justify-center text-slate-400 font-medium">
            {rank}
          </span>
        );
    }
  };

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-white">Leaderboard</h1>
      </div>

      {/* Current User Rank */}
      {currentUserRank && (
        <Card className="bg-orange-500/10 border-orange-500/30">
          <CardContent className="py-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-4">
                <div className="p-2 bg-orange-500/20 rounded-lg">
                  <User className="h-5 w-5 text-orange-500" />
                </div>
                <div>
                  <p className="font-semibold text-white">Your Rank</p>
                  <p className="text-sm text-slate-400">
                    {currentUserRank.showsPlayed} shows played
                  </p>
                </div>
              </div>
              <div className="text-right">
                <p className="text-3xl font-bold text-orange-500">
                  #{currentUserRank.rank}
                </p>
                <p className="text-sm text-slate-400">
                  {currentUserRank.totalPoints} pts
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Leaderboard Table */}
      {leaderboard.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Trophy className="h-12 w-12 text-slate-500 mx-auto mb-4" />
            <p className="text-slate-400">
              No scores yet for this tour.
            </p>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader className="border-b border-slate-700">
            <div className="grid grid-cols-12 text-sm font-medium text-slate-400">
              <div className="col-span-1">Rank</div>
              <div className="col-span-5 sm:col-span-4">Player</div>
              <div className="col-span-3 sm:col-span-2 text-center">Shows</div>
              <div className="col-span-3 sm:col-span-2 text-center hidden sm:block">
                Avg
              </div>
              <div className="col-span-3 text-right">Points</div>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <div className="divide-y divide-slate-700/50">
              {leaderboard.map((user) => {
                const isCurrentUser = session?.user?.id === user.userId;
                return (
                  <div
                    key={user.userId}
                    className={`grid grid-cols-12 items-center px-4 sm:px-6 py-4 ${
                      isCurrentUser ? "bg-orange-500/5" : ""
                    }`}
                  >
                    <div className="col-span-1">{getRankIcon(user.rank)}</div>
                    <div className="col-span-5 sm:col-span-4">
                      <p
                        className={`font-medium ${
                          isCurrentUser ? "text-orange-400" : "text-white"
                        }`}
                      >
                        {user.username}
                        {isCurrentUser && (
                          <span className="ml-2 text-xs text-orange-400">
                            (You)
                          </span>
                        )}
                      </p>
                      <p className="text-xs text-slate-500 sm:hidden">
                        {user.avgPoints} avg
                      </p>
                    </div>
                    <div className="col-span-3 sm:col-span-2 text-center text-slate-400">
                      {user.showsPlayed}
                    </div>
                    <div className="col-span-2 text-center text-slate-400 hidden sm:block">
                      {user.avgPoints}
                    </div>
                    <div className="col-span-3 text-right">
                      <span className="text-xl font-bold text-white">
                        {user.totalPoints}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Stats Legend */}
      <div className="flex items-center justify-center space-x-6 text-sm text-slate-500">
        <span className="flex items-center">
          <TrendingUp className="h-4 w-4 mr-1" />
          Points are cumulative per tour
        </span>
      </div>
    </div>
  );
}
