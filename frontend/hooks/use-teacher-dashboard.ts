import { useState, useEffect } from "react";
import { TeacherDashboardService, TeacherDashboardOverview } from "@/lib/teacher-dashboard-service";

export interface UseTeacherDashboardOptions {
  timeRange?: "week" | "month" | "semester";
  courseId?: number;
  autoFetch?: boolean;
}

export interface UseTeacherDashboardReturn {
  data: TeacherDashboardOverview | null;
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
  setTimeRange: (range: "week" | "month" | "semester") => void;
  setCourseId: (id: number | undefined) => void;
}

export function useTeacherDashboard(
  options: UseTeacherDashboardOptions = {}
): UseTeacherDashboardReturn {
  const { timeRange = "week", courseId, autoFetch = true } = options;

  const [data, setData] = useState<TeacherDashboardOverview | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [currentTimeRange, setCurrentTimeRange] = useState(timeRange);
  const [currentCourseId, setCurrentCourseId] = useState(courseId);

  const fetchData = async () => {
    setLoading(true);
    setError(null);

    try {
      const result = await TeacherDashboardService.getOverview(
        currentTimeRange,
        currentCourseId
      );
      setData(result);
    } catch (err) {
      console.error("Error fetching teacher dashboard data:", err);
      setError(err instanceof Error ? err.message : "Unknown error occurred");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (autoFetch) {
      fetchData();
    }
  }, [currentTimeRange, currentCourseId, autoFetch]);

  const setTimeRange = (range: "week" | "month" | "semester") => {
    setCurrentTimeRange(range);
  };

  const setCourseId = (id: number | undefined) => {
    setCurrentCourseId(id);
  };

  return {
    data,
    loading,
    error,
    refetch: fetchData,
    setTimeRange,
    setCourseId,
  };
}
