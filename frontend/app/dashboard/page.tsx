"use client";

import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { QuestBoard } from "@/components/dashboard/quest-board";
import { VirtualPet } from "@/components/dashboard/virtual-pet";
import { XPRewardDemo } from "@/components/dashboard/xp-reward-demo";
import { UserLevelDisplay } from "@/components/dashboard/user-level-display";
import { Card } from "@/components/ui/card";
import { useStudentProtection } from "@/hooks/use-role-protection";
import { useCurrentUser } from "@/hooks/useCurrentMoodleUser";
import { useDailyLoginQuest } from "@/hooks/use-daily-login-quest";
import {
  apiClient,
  type StudentProgress,
  type UserStreak,
} from "@/lib/api-client";
import {
  checkUserHasPet,
  getUserPet,
  createUserPet,
} from "@/lib/virtual-pet-api";
import { getLevelInfo } from "@/lib/leveling-system";
import { Flame } from "lucide-react";
import { PetOnboardingModal } from "@/components/dashboard/pet-onboarding-modal";
import { useGlobalXPReward } from "@/contexts/xp-reward-context";

export default function DashboardPage() {
  // Protect this route for students - teachers will be redirected to /teacher/dashboard
  useStudentProtection("/teacher/dashboard");
  const { user, loading: userLoading } = useCurrentUser();

  // XP Reward context for managing onboarding conflicts
  const { setOnboardingInProgress, isOnboardingInProgress } =
    useGlobalXPReward();

  // Initialize daily login quest auto-completion
  useDailyLoginQuest();

  const [studentProgress, setStudentProgress] =
    useState<StudentProgress | null>(null);
  const [progressLoading, setProgressLoading] = useState(true);
  const [progressError, setProgressError] = useState<string | null>(null);
  const [userStreak, setUserStreak] = useState<UserStreak | null>(null);
  const [streakLoading, setStreakLoading] = useState(true);
  const [hasPet, setHasPet] = useState<boolean>(false);
  const [petCheckLoading, setPetCheckLoading] = useState(true); // Start as true to show loading initially
  const [petCreationLoading, setPetCreationLoading] = useState(false);

  // Debug logging
  useEffect(() => {
    console.log("Dashboard - User state:", {
      user: user?.username,
      userLoading,
      hasPet,
      petCheckLoading,
      isOnboardingInProgress,
    });
  }, [user, userLoading, hasPet, petCheckLoading, isOnboardingInProgress]);

  // Debug logging for onboarding state
  useEffect(() => {
    console.log("Dashboard onboarding state changed:", {
      isOnboardingInProgress,
      hasPet,
      petCheckLoading,
      userLoading,
      userId: user?.id,
    });
  }, [isOnboardingInProgress, hasPet, petCheckLoading, userLoading, user?.id]);

  // Fetch student progress data
  useEffect(() => {
    const fetchProgress = async () => {
      if (!user?.id) {
        setProgressLoading(false);
        return;
      }

      try {
        setProgressLoading(true);
        const progress = await apiClient.fetchStudentProgress(user.id);
        setStudentProgress(progress);
        setProgressError(null);
      } catch (error) {
        console.error("Failed to fetch student progress:", error);
        setProgressError("Failed to load progress data");
      } finally {
        setProgressLoading(false);
      }
    };

    if (!userLoading && user) {
      fetchProgress();
    }
  }, [user, userLoading]);

  // Fetch user streak data
  useEffect(() => {
    const fetchStreak = async () => {
      if (!user?.id) {
        setStreakLoading(false);
        return;
      }

      try {
        setStreakLoading(true);
        const streakResponse = await apiClient.getUserStreak(
          user.id,
          "daily_login"
        );
        setUserStreak(streakResponse.streak);
      } catch (error) {
        console.error("Failed to fetch user streak:", error);
        // Set default streak data if API fails
        setUserStreak({
          current_streak: 0,
          longest_streak: 0,
          last_activity_date: null,
          streak_type: "daily_login",
        });
      } finally {
        setStreakLoading(false);
      }
    };

    if (!userLoading && user) {
      fetchStreak();
    }
  }, [user, userLoading]);

  // Check if user has a pet using the new stepwise approach
  useEffect(() => {
    const checkPet = async () => {
      if (!user?.id) {
        setPetCheckLoading(false);
        setHasPet(false);
        return;
      }

      try {
        setPetCheckLoading(true);
        console.log("Checking pet status for user:", user.username);

        // Step 1: Check if user has a pet
        const checkResponse = await checkUserHasPet();
        console.log("Pet check response:", checkResponse);

        if (!checkResponse.success) {
          console.error("Failed to check pet status:", checkResponse.message);
          setHasPet(false);
          return;
        }

        const hasPetStatus = checkResponse.data?.has_pet || false;
        setHasPet(hasPetStatus);

        if (hasPetStatus) {
          console.log(
            "User has a pet, will load it when VirtualPet component mounts"
          );
          // User has a pet, no onboarding needed
          setOnboardingInProgress(false);
        } else {
          console.log("User does not have a pet, will show onboarding");
          // User needs onboarding, delay XP rewards
          setOnboardingInProgress(true);
        }
      } catch (error) {
        console.error("Failed to check pet status:", error);
        setHasPet(false);
        // On error, don't block XP rewards
        setOnboardingInProgress(false);
      } finally {
        setPetCheckLoading(false);
      }
    };

    // Run pet check whenever we have a user, regardless of loading state
    if (user?.id) {
      checkPet();
    } else if (!userLoading) {
      // If no user and not loading, clear the pet state
      setPetCheckLoading(false);
      setHasPet(false);
      setOnboardingInProgress(false);
    }
  }, [user?.id, userLoading]); // Changed dependency to user?.id to trigger on user change
  // Get comprehensive level information using the leveling system
  const levelInfo = getLevelInfo(studentProgress?.total_exp || 0);

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.1,
      },
    },
  };

  const itemVariants = {
    hidden: { y: 20, opacity: 0 },
    visible: {
      y: 0,
      opacity: 1,
      transition: {
        type: "spring",
        stiffness: 100,
      },
    },
  };

  const hoverVariants = {
    hover: {
      scale: 1.02,
      transition: {
        type: "spring",
        stiffness: 400,
        damping: 10,
      },
    },
  };

  return (
    <motion.div
      initial="hidden"
      animate="visible"
      variants={containerVariants}
      className="container max-w-7xl mx-auto px-4 py-8"
    >
      {" "}
      {/* Welcome Section */}
      <motion.div variants={itemVariants} className="mb-8">
        <div className="flex items-start justify-between gap-4 mb-4">
          <div className="flex-1">
            <h1 className="text-4xl font-bold tracking-tight mb-2">
              Welcome back! 👋
            </h1>
            <p className="text-muted-foreground">
              Track your progress, complete quests, and level up your learning
              journey.
            </p>
          </div>

          {/* Streak Badge - Positioned at the right */}
          <motion.div
            className={`inline-flex items-center gap-2 px-3 md:px-4 py-1.5 md:py-2 rounded-full text-xs md:text-sm font-medium ${
              streakLoading
                ? "bg-gray-100 text-gray-500"
                : userStreak && userStreak.current_streak > 0
                ? userStreak.current_streak >= 30
                  ? "bg-gradient-to-r from-purple-500 to-pink-500 text-white shadow-lg"
                  : userStreak.current_streak >= 14
                  ? "bg-gradient-to-r from-blue-500 to-indigo-500 text-white shadow-lg"
                  : userStreak.current_streak >= 7
                  ? "bg-gradient-to-r from-orange-500 to-red-500 text-white shadow-lg"
                  : "bg-primary/10 text-primary"
                : "bg-gray-100 text-gray-500"
            }`}
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            whileHover={{ scale: 1.05 }}
          >
            <Flame
              className={`h-3 w-3 md:h-4 md:w-4 ${
                userStreak && userStreak.current_streak >= 7
                  ? "animate-pulse"
                  : ""
              }`}
            />
            {streakLoading ? (
              "Loading streak..."
            ) : userStreak && userStreak.current_streak > 0 ? (
              <>
                {userStreak.current_streak} Day Streak
                {userStreak.current_streak >= 30 && " 🔥"}
                {userStreak.current_streak >= 14 &&
                  userStreak.current_streak < 30 &&
                  " ⚡"}
                {userStreak.current_streak >= 7 &&
                  userStreak.current_streak < 14 &&
                  " 🌟"}
              </>
            ) : (
              "Start your streak!"
            )}
          </motion.div>
        </div>

        {progressError && (
          <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg">
            <p className="text-sm text-red-600">
              ⚠️ {progressError} - Showing default values
            </p>
          </div>
        )}
      </motion.div>
      <div className="grid gap-6 md:grid-cols-12">
        {/* Main Content Area - Left Side */}
        <motion.div variants={itemVariants} className="md:col-span-8 space-y-6">
          {" "}
          {/* Quick Stats */}
          <div className="grid gap-4 grid-cols-2 sm:grid-cols-4">
            <motion.div
              variants={hoverVariants}
              whileHover="hover"
              className="bg-gradient-to-br from-violet-500 to-violet-600 rounded-xl p-4 text-white"
            >
              <h3 className="text-sm font-medium text-violet-100">Total XP</h3>
              <p className="text-2xl font-bold">
                {progressLoading ? "..." : studentProgress?.total_exp || 0}
              </p>
            </motion.div>
            <motion.div
              variants={hoverVariants}
              whileHover="hover"
              className="bg-gradient-to-br from-amber-500 to-amber-600 rounded-xl p-4 text-white"
            >
              <h3 className="text-sm font-medium text-amber-100">
                Current Level
              </h3>{" "}
              <p className="text-2xl font-bold">
                {progressLoading ? "..." : levelInfo.level}
              </p>
            </motion.div>
            <motion.div
              variants={hoverVariants}
              whileHover="hover"
              className="bg-gradient-to-br from-emerald-500 to-emerald-600 rounded-xl p-4 text-white"
            >
              <h3 className="text-sm font-medium text-emerald-100">
                Overall Quests Done
              </h3>
              <p className="text-2xl font-bold">
                {progressLoading
                  ? "..."
                  : studentProgress?.quests_completed || 0}
              </p>
            </motion.div>
            <motion.div
              variants={hoverVariants}
              whileHover="hover"
              className="bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl p-4 text-white"
            >
              <h3 className="text-sm font-medium text-blue-100">
                Achievements
              </h3>
              <p className="text-2xl font-bold">
                {progressLoading ? "..." : studentProgress?.badges_earned || 0}
              </p>
            </motion.div>
          </div>
          {/* Quest Board Section */}
          <motion.div
            variants={hoverVariants}
            whileHover="hover"
            className="bg-card rounded-xl border shadow-sm overflow-hidden"
          >
            <div className="p-6">
              <h2 className="text-2xl font-semibold mb-4">Active Quests</h2>
              <QuestBoard />
            </div>
          </motion.div>
        </motion.div>

        {/* Sidebar - Right Side */}
        <motion.div variants={itemVariants} className="md:col-span-4 space-y-6">
          {/* Virtual Pet Card */}
          <motion.div
            variants={hoverVariants}
            whileHover="hover"
            className="bg-card rounded-xl border shadow-sm overflow-hidden"
          >
            <div className="p-6">
              <h2 className="text-2xl font-semibold mb-4">Your Pet</h2>
              {petCheckLoading ? (
                <p className="text-muted-foreground">
                  Checking for your pet...
                </p>
              ) : hasPet ? (
                <>
                  {/* <p className="text-xs text-green-600 mb-2">✓ Pet found</p> */}
                  <VirtualPet />
                </>
              ) : (
                <>
                  <p className="text-xs text-blue-600 mb-2">
                    No pet found - showing onboarding
                  </p>
                  <PetOnboardingModal
                    isOpen={true}
                    onClose={() => {}}
                    onCreatePet={async (name: string, species: string) => {
                      setPetCreationLoading(true);
                      try {
                        console.log("Creating pet:", name, species);
                        const result = await createUserPet(name, species);
                        console.log("Pet creation result:", result);
                        if (result.success) {
                          // Re-check pet status after creation to confirm
                          const checkResponse = await checkUserHasPet();
                          if (
                            checkResponse.success &&
                            checkResponse.data?.has_pet
                          ) {
                            setHasPet(true);
                            // Mark onboarding as complete - this will trigger queued XP rewards
                            setOnboardingInProgress(false);
                            console.log(
                              "Pet created and verified successfully! Onboarding complete."
                            );
                          } else {
                            console.error(
                              "Pet creation succeeded but verification failed"
                            );
                          }
                        } else {
                          console.error(
                            "Failed to create pet:",
                            result.message
                          );
                        }
                      } catch (error) {
                        console.error("Error creating pet:", error);
                      } finally {
                        setPetCreationLoading(false);
                      }
                    }}
                    isLoading={petCreationLoading}
                  />
                </>
              )}
            </div>
          </motion.div>

          {/* User Level Display */}
          <UserLevelDisplay levelInfo={levelInfo} loading={progressLoading} />

          {/* Daily Quests */}
          {/* <motion.div
            variants={hoverVariants}
            whileHover="hover"
            className="bg-card rounded-xl border shadow-sm overflow-hidden"
          >
            <div className="p-6">
              <DailyQuests />
            </div>
          </motion.div> */}

          {/* XP Reward Demo */}
          {/* <motion.div
            variants={hoverVariants}
            whileHover="hover"
            className="bg-card rounded-xl border shadow-sm overflow-hidden"
          >
            <div className="p-6">
              <XPRewardDemo />
            </div>
          </motion.div> */}
        </motion.div>
      </div>
    </motion.div>
  );
}
