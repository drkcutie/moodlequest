import { apiClient } from "./api-client";

// Helper function to get cookies
function getCookie(name: string): string | null {
  const cookies = document.cookie.split(";").reduce((acc, cookie) => {
    const [cookieName, value] = cookie.trim().split("=");
    acc[cookieName] = value;
    return acc;
  }, {} as Record<string, string>);

  return cookies[name] || null;
}

export interface TeacherDashboardOverview {
  activeQuests: {
    active: number;
    total: number;
    nearDue: number;
  };
  questCompletion: {
    rate: number;
    change: number;
    completed: number;
    total: number;
  };
  engagementScore: {
    score: number;
    maxScore: number;
    breakdown: {
      consistency: number;
      participation: number;
      diversity: number;
    };
  };
}

export interface RecentActivity {
  userId: number;
  studentName: string;
  action: string;
  timestamp: string;
  timeAgo: string;
}

export interface EngagementData {
  day: string;
  activeUsers: number;
  badgesEarned: number;
  questsCompleted: number;
}

export interface EngagementInsights {
  loginPatterns: Array<{ hour: number; uniqueUsers: number }>;
  activityHeatmap: Record<string, Record<number, number>>;
  engagementLevels: {
    high: number;
    medium: number;
    low: number;
  };
  streakAnalysis: {
    currentStreak: number;
    maxStreak: number;
    totalDays: number;
    activeDays: number;
    consistencyRate: number;
  };
  timePeriods: Array<{ period: string; activityCount: number }>;
  actionDistribution: Array<{ action: string; count: number }>;
}

export class TeacherDashboardService {
  /**
   * Get teacher dashboard overview data by aggregating analytics
   */
  static async getOverview(
    timeRange: "week" | "month" | "semester" = "week",
    courseId?: number
  ): Promise<TeacherDashboardOverview> {
    try {
      // Get moodle token from cookies
      const moodleToken = getCookie("moodleToken");
      if (!moodleToken) {
        throw new Error("No authentication token available");
      }
      apiClient.setToken(moodleToken);

      const params = new URLSearchParams({
        time_range: timeRange,
        ...(courseId && { course_id: courseId.toString() }),
      });

      // Fetch engagement analytics, insights, and teacher's quests in parallel
      const [engagementResponse, insightsResponse, questsResponse] =
        await Promise.all([
          apiClient.request<{
            success: boolean;
            data: EngagementData[];
            timeRange: string;
            courseId?: number;
          }>(`/analytics/engagement?${params}`),
          apiClient.request<{
            success: boolean;
            data: EngagementInsights;
            timeRange: string;
            courseId?: number;
          }>(`/analytics/engagement-insights?${params}`),
          // Fetch teacher's quests using the my-quests endpoint
          apiClient.request<{
            success: boolean;
            data: Array<{
              quest_id: number;
              title: string;
              is_active: boolean;
              end_date: string | null;
              created_at: string;
            }>;
          }>(`/quests/my-quests`),
        ]);

      if (!engagementResponse.success || !insightsResponse.success) {
        throw new Error("Failed to fetch analytics data");
      }

      // Calculate overview metrics from the analytics data
      return this.calculateOverviewMetrics(
        engagementResponse.data,
        insightsResponse.data,
        questsResponse.success ? questsResponse.data : []
      );
    } catch (error) {
      console.error("Error fetching teacher dashboard overview:", error);
      throw error;
    }
  }

  /**
   * Get recent activity data based on engagement analytics
   */
  static async getRecentActivity(
    limit: number = 10,
    courseId?: number
  ): Promise<RecentActivity[]> {
    try {
      const params = new URLSearchParams({
        time_range: "week",
        ...(courseId && { course_id: courseId.toString() }),
      });

      // Fetch recent engagement data to generate activity
      const response = await apiClient.request<{
        success: boolean;
        data: EngagementData[];
      }>(`/analytics/engagement?${params}`);

      if (!response.success) {
        throw new Error("Failed to fetch engagement data");
      }

      // Generate mock recent activities based on engagement data
      return this.generateRecentActivities(response.data, limit);
    } catch (error) {
      console.error("Error fetching recent activity:", error);
      throw error;
    }
  }

  /**
   * Calculate overview metrics from analytics data
   */
  private static calculateOverviewMetrics(
    engagementData: EngagementData[],
    insightsData: EngagementInsights,
    questsData: Array<{
      quest_id: number;
      title: string;
      is_active: boolean;
      end_date: string | null;
      created_at: string;
    }>
  ): TeacherDashboardOverview {
    const now = new Date();

    // Calculate active quests metrics
    const totalQuests = questsData.length;
    const activeQuests = questsData.filter((quest) => quest.is_active).length;

    // Calculate quests near due (within 7 days)
    const nearDueQuests = questsData.filter((quest) => {
      if (!quest.end_date || !quest.is_active) return false;
      const endDate = new Date(quest.end_date);
      const daysUntilDue = Math.ceil(
        (endDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
      );
      return daysUntilDue >= 0 && daysUntilDue <= 7;
    }).length;

    // Calculate quest completion rate
    const totalQuestsCompleted = engagementData.reduce(
      (sum, day) => sum + day.questsCompleted,
      0
    );
    const totalBadgesEarned = engagementData.reduce(
      (sum, day) => sum + day.badgesEarned,
      0
    );

    // Estimate completion rate based on quest activity
    // Assume each completed quest represents successful completion
    const estimatedTotalAttempts = Math.max(
      totalQuestsCompleted * 1.3,
      totalQuestsCompleted
    ); // 30% failure rate estimate
    const questCompletionRate =
      estimatedTotalAttempts > 0
        ? (totalQuestsCompleted / estimatedTotalAttempts) * 100
        : 0;

    // Calculate change from previous period (simplified)
    const firstHalf = engagementData.slice(
      0,
      Math.floor(engagementData.length / 2)
    );
    const secondHalf = engagementData.slice(
      Math.floor(engagementData.length / 2)
    );

    const firstHalfQuests = firstHalf.reduce(
      (sum, day) => sum + day.questsCompleted,
      0
    );
    const secondHalfQuests = secondHalf.reduce(
      (sum, day) => sum + day.questsCompleted,
      0
    );
    const questChange =
      firstHalfQuests > 0
        ? ((secondHalfQuests - firstHalfQuests) / firstHalfQuests) * 100
        : 0;

    // Calculate engagement score (0-10 scale)
    const consistencyRate = insightsData.streakAnalysis?.consistencyRate || 0;
    // Estimate total students from engagement levels
    const totalStudents =
      (insightsData.engagementLevels?.high || 0) +
      (insightsData.engagementLevels?.medium || 0) +
      (insightsData.engagementLevels?.low || 0);
    const highEngagementRatio =
      totalStudents > 0
        ? (insightsData.engagementLevels?.high || 0) / totalStudents
        : 0;
    const activityDiversity = Math.min(
      (insightsData.actionDistribution?.length || 0) / 8,
      1
    ); // Normalize to 8 action types

    const engagementScore =
      (consistencyRate / 100) * 3.5 + // Consistency: max 3.5 points
      highEngagementRatio * 4.0 + // High engagement ratio: max 4.0 points
      activityDiversity * 2.5; // Activity diversity: max 2.5 points

    return {
      activeQuests: {
        active: activeQuests,
        total: totalQuests,
        nearDue: nearDueQuests,
      },
      questCompletion: {
        rate: Math.round(questCompletionRate * 10) / 10,
        change: Math.round(questChange * 10) / 10,
        completed: totalQuestsCompleted,
        total: Math.round(estimatedTotalAttempts),
      },
      engagementScore: {
        score: Math.round(engagementScore * 10) / 10,
        maxScore: 10.0,
        breakdown: {
          consistency: Math.round((consistencyRate / 100) * 3.5 * 10) / 10,
          participation: Math.round(highEngagementRatio * 4.0 * 10) / 10,
          diversity: Math.round(activityDiversity * 2.5 * 10) / 10,
        },
      },
    };
  }

  /**
   * Generate mock recent activities based on engagement data
   */
  private static generateRecentActivities(
    engagementData: EngagementData[],
    limit: number
  ): RecentActivity[] {
    const activities: RecentActivity[] = [];
    const now = new Date();

    // Sample student names
    const students = [
      "Sarah Johnson",
      "Michael Rodriguez",
      "Emily Chen",
      "James Wilson",
      "David Chen",
      "Maria Garcia",
      "Alex Thompson",
      "Lisa Wang",
      "Robert Kim",
      "Jessica Brown",
      "Kevin Lee",
      "Amanda Davis",
    ];

    // Sample activities based on engagement data
    const activityTypes = [
      { type: "quest_complete", template: 'Completed "[QUEST_NAME]" quest' },
      { type: "badge_earned", template: 'Earned "[BADGE_NAME]" badge' },
      { type: "quest_start", template: 'Started "[QUEST_NAME]" quest' },
      { type: "level_up", template: "Reached Level [LEVEL]" },
      {
        type: "assignment_submit",
        template: 'Submitted assignment "[ASSIGNMENT_NAME]"',
      },
      { type: "quiz_complete", template: 'Completed quiz "[QUIZ_NAME]"' },
    ];

    const questNames = [
      "Algebra Basics",
      "Chemical Reactions",
      "Literary Analysis",
      "Physics Fundamentals",
      "Programming Logic",
      "Historical Events",
      "Biology Cells",
      "Geometry Proofs",
    ];

    const badgeNames = [
      "Science Explorer",
      "Math Wizard",
      "Speed Reader",
      "Problem Solver",
      "Team Player",
      "Creative Thinker",
      "Research Master",
      "Quick Learner",
    ];

    const assignmentNames = [
      "Essay Analysis",
      "Lab Report",
      "Research Project",
      "Case Study",
      "Problem Set",
      "Group Presentation",
      "Data Analysis",
      "Creative Writing",
    ];

    const quizNames = [
      "Chapter 5 Quiz",
      "Midterm Review",
      "Weekly Assessment",
      "Practice Test",
      "Vocabulary Check",
      "Concept Review",
      "Final Exam Prep",
      "Unit Test",
    ];

    // Generate activities based on recent engagement
    const recentDays = engagementData.slice(-3); // Last 3 days
    let activityIndex = 0;

    for (
      let dayIndex = 0;
      dayIndex < recentDays.length && activities.length < limit;
      dayIndex++
    ) {
      const day = recentDays[dayIndex];
      const activitiesForDay = Math.min(
        Math.ceil((day.questsCompleted + day.badgesEarned) / 2),
        Math.ceil(limit / recentDays.length)
      );

      for (let i = 0; i < activitiesForDay && activities.length < limit; i++) {
        const student = students[activityIndex % students.length];
        const activityType =
          activityTypes[activityIndex % activityTypes.length];

        let description = activityType.template;

        // Replace placeholders
        description = description.replace(
          "[QUEST_NAME]",
          questNames[activityIndex % questNames.length]
        );
        description = description.replace(
          "[BADGE_NAME]",
          badgeNames[activityIndex % badgeNames.length]
        );
        description = description.replace(
          "[ASSIGNMENT_NAME]",
          assignmentNames[activityIndex % assignmentNames.length]
        );
        description = description.replace(
          "[QUIZ_NAME]",
          quizNames[activityIndex % quizNames.length]
        );
        description = description.replace(
          "[LEVEL]",
          String(Math.floor(Math.random() * 10) + 1)
        );

        // Calculate time ago (distribute across last few hours/days)
        const hoursAgo = dayIndex * 24 + i * 2 + Math.floor(Math.random() * 2);
        const timestamp = new Date(now.getTime() - hoursAgo * 60 * 60 * 1000);

        activities.push({
          userId: activityIndex + 1,
          studentName: student,
          action: description,
          timestamp: timestamp.toISOString(),
          timeAgo: this.formatTimeAgo(timestamp),
        });

        activityIndex++;
      }
    }

    return activities.slice(0, limit);
  }

  /**
   * Format time ago string
   */
  private static formatTimeAgo(timestamp: Date): string {
    const now = new Date();
    const diff = now.getTime() - timestamp.getTime();
    const minutes = Math.floor(diff / (1000 * 60));
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));

    if (minutes < 60) {
      return minutes <= 1 ? "Just now" : `${minutes} minutes ago`;
    } else if (hours < 24) {
      return hours === 1 ? "1 hour ago" : `${hours} hours ago`;
    } else {
      return days === 1 ? "1 day ago" : `${days} days ago`;
    }
  }
}
