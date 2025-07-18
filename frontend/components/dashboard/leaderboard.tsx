"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Trophy,
  Star,
  Medal,
  Flame,
  Award,
  Crown,
  Users,
  Calendar,
  History,
  Search,
  RefreshCw,
  Loader2,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import { useLeaderboard } from "@/hooks/useLeaderboard";
import { LeaderboardUser, TimeFrameOption } from "@/types/gamification";

interface LeaderboardProps {
  courseId?: number;
  className?: string;
}

const timeFrames = ["daily", "weekly", "monthly", "all_time"] as const;
const timeFrameLabels: Record<TimeFrameOption, string> = {
  daily: "Daily",
  weekly: "Weekly",
  monthly: "Monthly",
  all_time: "All Time",
};

const rankIconMap = {
  Master: {
    icon: <Trophy className="h-full w-full" />,
    color: "text-yellow-500",
    bgColor: "bg-yellow-500/10",
    borderColor: "border-yellow-500/20",
  },
  Expert: {
    icon: <Star className="h-full w-full" />,
    color: "text-purple-500",
    bgColor: "bg-purple-500/10",
    borderColor: "border-purple-500/20",
  },
  Intermediate: {
    icon: <Medal className="h-full w-full" />,
    color: "text-blue-500",
    bgColor: "bg-blue-500/10",
    borderColor: "border-blue-500/20",
  },
  Beginner: {
    icon: <Award className="h-full w-full" />,
    color: "text-green-500",
    bgColor: "bg-green-500/10",
    borderColor: "border-green-500/20",
  },
};

export function Leaderboard({ courseId, className }: LeaderboardProps) {
  const {
    data,
    loading,
    error,
    timeframe,
    searchQuery,
    searchResults,
    searchLoading,
    setTimeframe,
    setSearchQuery,
    refresh,
    loadMore,
    hasMore,
  } = useLeaderboard({
    courseId,
    initialTimeframe: "weekly",
    autoFetch: true,
  });

  const { topUsers, otherUsers, totalParticipants } = data;

  // Use search results if searching, otherwise use regular data
  const displayedOtherUsers = searchQuery.trim()
    ? searchResults.slice(3)
    : otherUsers;
  const displayedTopUsers = searchQuery.trim()
    ? searchResults.slice(0, 3)
    : topUsers;

  const getRankInfo = (rank: string) => {
    return (
      rankIconMap[rank as keyof typeof rankIconMap] || {
        icon: <Award className="h-full w-full" />,
        color: "text-gray-500",
        bgColor: "bg-gray-500/10",
        borderColor: "border-gray-500/20",
      }
    );
  };

  const getTimeframeIcon = (timeframe: TimeFrameOption) => {
    switch (timeframe) {
      case "daily":
        return <Calendar className="h-4 w-4 mr-2" />;
      case "weekly":
        return <Users className="h-4 w-4 mr-2" />;
      case "monthly":
        return <Flame className="h-4 w-4 mr-2" />;
      case "all_time":
        return <History className="h-4 w-4 mr-2" />;
    }
  };

  const renderUserCard = (user: LeaderboardUser, index: number) => {
    const rankInfo = getRankInfo(user.rank);
    const position = user.position || index + 4;

    return (
      <motion.div
        key={user.id}
        className="relative flex items-center bg-gradient-to-r from-card/90 to-card/50 hover:from-card/95 hover:to-card/60 dark:from-card/50 dark:to-background border border-border/50 rounded-lg p-3 overflow-hidden backdrop-blur-sm transition-colors shadow-md"
        initial={{ opacity: 0, x: -20 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ delay: index * 0.1 }}
      >
        {/* Background decoration */}
        <div
          className={`absolute right-0 top-0 bottom-0 w-1/3 ${rankInfo.bgColor} opacity-10 blur-xl pointer-events-none`}
        ></div>

        <div className="flex items-center justify-between w-full gap-2">
          <div className="flex items-center gap-3 min-w-0">
            <div className="flex items-center justify-center h-8 w-8 rounded-full bg-muted/80 dark:bg-muted text-sm font-medium border border-border/50">
              {position}
            </div>
            <Avatar className="h-10 w-10 border-2 border-muted ring-2 ring-border/50 shadow-md">
              <AvatarImage src={user.profile_image_url || undefined} />
              <AvatarFallback className="bg-gradient-to-br from-primary/80 to-primary text-primary-foreground">
                {`${user.first_name[0] || user.username[0]}${
                  user.last_name[0] || user.username[1] || ""
                }`}
              </AvatarFallback>
            </Avatar>
            <div className="min-w-0">
              <div className="font-medium truncate">{user.username}</div>
              <div className="flex items-center gap-1">
                <div
                  className={`h-5 w-5 rounded-full p-1 ${rankInfo.bgColor} shadow-sm`}
                >
                  {rankInfo.icon}
                </div>
                <span className={`text-sm ${rankInfo.color}`}>{user.rank}</span>
              </div>
            </div>
          </div>

          <div className="hidden sm:flex items-center gap-8">
            <div className="flex flex-col items-center">
              <div className="text-xs text-muted-foreground">Level</div>
              <div className="font-medium text-amber-600 dark:text-amber-500">
                {user.level}
              </div>
            </div>
            <div className="flex flex-col items-center">
              <div className="text-xs text-muted-foreground">Quests</div>
              <div className="font-medium text-purple-600 dark:text-purple-500">
                {user.stats.quests_completed}
              </div>
            </div>
            <div className="flex flex-col items-center">
              <div className="text-xs text-muted-foreground">XP</div>
              <div className="font-medium text-emerald-600 dark:text-emerald-500">
                {user.stats.exp_points}
              </div>
            </div>
          </div>

          <div className="sm:hidden flex items-center gap-2">
            <div className="text-sm font-medium text-amber-600 dark:text-amber-500">
              Lvl {user.level}
            </div>
            <div className="text-sm text-muted-foreground">•</div>
            <div className="text-sm font-medium text-emerald-600 dark:text-emerald-500">
              {user.stats.exp_points} XP
            </div>
          </div>
        </div>
      </motion.div>
    );
  };

  return (
    <Card className={`overflow-hidden border-none shadow-lg ${className}`}>
      <div className="relative bg-gradient-to-br from-primary/20 via-background to-background p-6 border-b dark:border-border/50 border-primary/10">
        {/* Decorative elements */}
        <div className="absolute top-0 right-0 w-64 h-64 bg-primary/5 dark:bg-primary/5 bg-gradient-to-br from-orange-100/50 via-amber-50/30 to-transparent rounded-full -translate-y-1/2 translate-x-1/2 blur-3xl pointer-events-none"></div>
        <div className="absolute bottom-0 left-0 w-32 h-32 bg-primary/10 dark:bg-primary/10 bg-gradient-to-tr from-blue-100/50 via-purple-50/30 to-transparent rounded-full translate-y-1/2 -translate-x-1/2 blur-3xl pointer-events-none"></div>

        <div className="relative flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
          <div className="flex items-center gap-4">
            <div className="relative">
              <div className="absolute inset-0 bg-orange-500/20 dark:bg-orange-500/20 bg-gradient-to-br from-orange-200 to-amber-100 dark:from-orange-500/20 dark:to-amber-500/20 blur-md rounded-full"></div>
              <div className="relative bg-gradient-to-br from-orange-400 to-orange-600 dark:from-orange-400 dark:to-orange-600 rounded-full p-3 shadow-lg shadow-orange-500/20">
                <Trophy className="h-6 w-6 text-white" />
              </div>
            </div>
            <div>
              <h2 className="text-xl font-semibold bg-clip-text text-transparent bg-gradient-to-r from-orange-600 to-amber-600 dark:text-white">
                {courseId ? "Course Leaderboard" : "Global Leaderboard"}
              </h2>
              <p className="text-muted-foreground text-sm">
                {totalParticipants > 0
                  ? `${totalParticipants} participants`
                  : "Compete with others and climb the ranks"}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <div className="relative w-full md:w-64">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              {searchLoading && (
                <Loader2 className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground animate-spin" />
              )}
              <input
                type="text"
                placeholder="Search players..."
                className="h-10 w-full rounded-md border border-input bg-white/50 dark:bg-background pl-10 pr-10 text-sm ring-offset-background backdrop-blur-sm transition-colors hover:bg-accent/10 focus:bg-accent/10"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={refresh}
              disabled={loading}
              className="whitespace-nowrap"
            >
              {loading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <RefreshCw className="h-4 w-4" />
              )}
            </Button>
          </div>
        </div>

        {/* Time frame selector */}
        <Tabs
          value={timeframe}
          onValueChange={(v) => setTimeframe(v as TimeFrameOption)}
          className="w-full"
        >
          <TabsList className="grid grid-cols-4 w-full md:w-fit bg-white/50 dark:bg-background backdrop-blur-sm">
            {timeFrames.map((timeFrame) => (
              <TabsTrigger
                key={timeFrame}
                value={timeFrame}
                className="flex items-center data-[state=active]:bg-gradient-to-b data-[state=active]:from-primary/90 data-[state=active]:to-primary data-[state=active]:text-primary-foreground"
              >
                {getTimeframeIcon(timeFrame)}
                <span className="hidden sm:inline">
                  {timeFrameLabels[timeFrame]}
                </span>
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
      </div>

      {/* Error state */}
      {error && (
        <div className="p-6 text-center">
          <div className="text-red-500 mb-2">Failed to load leaderboard</div>
          <Button variant="outline" onClick={refresh} size="sm">
            Try Again
          </Button>
        </div>
      )}

      {/* Loading state */}
      {loading && !data.topUsers.length && (
        <div className="p-6 text-center">
          <Loader2 className="h-8 w-8 animate-spin mx-auto mb-2" />
          <div className="text-muted-foreground">Loading leaderboard...</div>
        </div>
      )}

      {/* Content */}
      {!loading || data.topUsers.length > 0 ? (
        <div className="relative p-6 pb-16 bg-gradient-to-b from-background via-background to-muted/20">
          {/* Top players podium */}
          {displayedTopUsers.length > 0 && (
            <div className="flex items-end justify-center mb-8 mt-4">
              {/* Second place */}
              {displayedTopUsers[1] && (
                <motion.div
                  className="flex-1 mx-2 order-1 z-10"
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.1 }}
                >
                  <div className="flex flex-col items-center">
                    <Avatar className="h-16 w-16 border-4 border-primary/20 ring-2 ring-primary/10 mb-2 shadow-xl">
                      <AvatarImage
                        src={
                          displayedTopUsers[1].profile_image_url || undefined
                        }
                      />
                      <AvatarFallback className="bg-gradient-to-br from-blue-500 to-purple-600 text-white">
                        {`${
                          displayedTopUsers[1].first_name[0] ||
                          displayedTopUsers[1].username[0]
                        }${
                          displayedTopUsers[1].last_name[0] ||
                          displayedTopUsers[1].username[1] ||
                          ""
                        }`}
                      </AvatarFallback>
                    </Avatar>
                    <div className="text-center">
                      <div className="font-semibold truncate max-w-[80px] sm:max-w-full">
                        {displayedTopUsers[1].username}
                      </div>
                      <Badge
                        variant="secondary"
                        className="mt-1 bg-gradient-to-r from-blue-500/10 to-purple-500/10 text-blue-700 dark:text-blue-400 border-blue-500/20"
                      >
                        <Medal className="h-3 w-3 mr-1" />
                        2nd
                      </Badge>
                    </div>
                  </div>
                  <div className="h-28 mt-2 bg-gradient-to-t from-card/80 to-background dark:from-card border border-border/50 backdrop-blur-sm rounded-t-lg flex items-center justify-center px-4 shadow-lg">
                    <div className="text-center">
                      <div className="font-medium text-2xl bg-clip-text text-transparent bg-gradient-to-r from-blue-600 to-purple-600 dark:text-primary/90">
                        {displayedTopUsers[1]?.stats?.exp_points ?? 0}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        XP POINTS
                      </div>
                    </div>
                  </div>
                </motion.div>
              )}

              {/* First place */}
              {displayedTopUsers[0] && (
                <motion.div
                  className="flex-1 mx-2 order-2 z-20"
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                >
                  <div className="relative">
                    <div className="absolute -top-14 left-1/2 -translate-x-1/2">
                      <div className="relative">
                        <div className="absolute -inset-2 bg-yellow-500/20 rounded-full blur-md"></div>
                        <Crown className="h-8 w-8 text-yellow-500 drop-shadow-[0_0_10px_rgba(234,179,8,0.3)]" />
                      </div>
                    </div>
                  </div>
                  <div className="flex flex-col items-center">
                    <Avatar className="h-20 w-20 border-4 border-yellow-500/30 ring-4 ring-yellow-500/20 mb-2 shadow-xl">
                      <AvatarImage
                        src={
                          displayedTopUsers[0].profile_image_url || undefined
                        }
                      />
                      <AvatarFallback className="bg-gradient-to-br from-yellow-500 to-amber-600 text-white">
                        {`${
                          displayedTopUsers[0].first_name[0] ||
                          displayedTopUsers[0].username[0]
                        }${
                          displayedTopUsers[0].last_name[0] ||
                          displayedTopUsers[0].username[1] ||
                          ""
                        }`}
                      </AvatarFallback>
                    </Avatar>
                    <div className="text-center">
                      <div className="font-semibold truncate max-w-[100px] sm:max-w-full">
                        {displayedTopUsers[0].username}
                      </div>
                      <Badge
                        variant="outline"
                        className="bg-gradient-to-r from-yellow-600/80 to-amber-500/80 text-white border-none mt-1 shadow-md shadow-yellow-500/20"
                      >
                        <Trophy className="h-3 w-3 mr-1" />
                        1st
                      </Badge>
                    </div>
                  </div>
                  <div className="h-36 mt-2 bg-gradient-to-t from-card/80 to-card/50 dark:from-card border border-border/50 backdrop-blur-sm rounded-t-lg flex items-center justify-center px-4 relative overflow-hidden shadow-lg">
                    <div className="absolute inset-0 opacity-10 pointer-events-none">
                      <div className="absolute top-0 left-1/2 -translate-x-1/2 h-32 w-32 bg-yellow-500/30 rounded-full blur-3xl"></div>
                    </div>
                    <div className="text-center relative">
                      <div className="font-medium text-3xl bg-clip-text text-transparent bg-gradient-to-r from-yellow-600 to-amber-500 dark:text-primary/90">
                        {displayedTopUsers[0].stats.exp_points}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        XP POINTS
                      </div>
                    </div>
                  </div>
                </motion.div>
              )}

              {/* Third place */}
              {displayedTopUsers[2] && (
                <motion.div
                  className="flex-1 mx-2 order-3 z-10"
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.2 }}
                >
                  <div className="flex flex-col items-center">
                    <Avatar className="h-16 w-16 border-4 border-primary/20 ring-2 ring-primary/10 mb-2 shadow-xl">
                      <AvatarImage
                        src={
                          displayedTopUsers[2].profile_image_url || undefined
                        }
                      />
                      <AvatarFallback className="bg-gradient-to-br from-emerald-500 to-green-600 text-white">
                        {`${
                          displayedTopUsers[2].first_name[0] ||
                          displayedTopUsers[2].username[0]
                        }${
                          displayedTopUsers[2].last_name[0] ||
                          displayedTopUsers[2].username[1] ||
                          ""
                        }`}
                      </AvatarFallback>
                    </Avatar>
                    <div className="text-center">
                      <div className="font-semibold truncate max-w-[80px] sm:max-w-full">
                        {displayedTopUsers[2].username}
                      </div>
                      <Badge
                        variant="secondary"
                        className="mt-1 bg-gradient-to-r from-emerald-500/10 to-green-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/20"
                      >
                        <Medal className="h-3 w-3 mr-1" />
                        3rd
                      </Badge>
                    </div>
                  </div>
                  <div className="h-24 mt-2 bg-gradient-to-t from-card/80 to-card/50 dark:from-card border border-border/50 backdrop-blur-sm rounded-t-lg flex items-center justify-center px-4 shadow-lg">
                    <div className="text-center">
                      <div className="font-medium text-2xl bg-clip-text text-transparent bg-gradient-to-r from-emerald-600 to-green-600 dark:text-primary/90">
                        {displayedTopUsers[2].stats.exp_points}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        XP POINTS
                      </div>
                    </div>
                  </div>
                </motion.div>
              )}
            </div>
          )}

          {/* Platform base */}
          <div className="absolute bottom-0 left-0 right-0 h-8 bg-gradient-to-t from-muted/30 to-card/50 dark:from-card dark:to-background border-t border-border/50 backdrop-blur-sm"></div>

          <h3 className="text-lg font-medium mb-4 px-2 bg-clip-text text-transparent bg-gradient-to-r from-primary to-primary/80 dark:text-primary">
            Ranking
          </h3>

          {/* Others leaderboard */}
          <div className="space-y-3">
            <AnimatePresence>
              {displayedOtherUsers.map((user, index) =>
                renderUserCard(user, index)
              )}
            </AnimatePresence>
          </div>

          {/* Load more button */}
          {!searchQuery.trim() && hasMore && displayedOtherUsers.length > 0 && (
            <div className="mt-6 flex justify-center">
              <Button
                variant="outline"
                size="sm"
                onClick={loadMore}
                disabled={loading}
                className="bg-gradient-to-r from-card/80 to-card/50 hover:from-card/90 hover:to-card/60 border-primary/20 shadow-md"
              >
                {loading ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Loading...
                  </>
                ) : (
                  "Show More"
                )}
              </Button>
            </div>
          )}

          {/* Empty state */}
          {!loading &&
            displayedTopUsers.length === 0 &&
            displayedOtherUsers.length === 0 && (
              <div className="text-center py-12">
                <Trophy className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <h3 className="text-lg font-medium mb-2">
                  No participants yet
                </h3>
                <p className="text-muted-foreground">
                  {searchQuery.trim()
                    ? "No players found matching your search."
                    : "Be the first to join the leaderboard!"}
                </p>
              </div>
            )}
        </div>
      ) : null}
    </Card>
  );
}
