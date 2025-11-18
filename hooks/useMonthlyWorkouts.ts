import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase, isSupabaseConfigured } from "@/lib/supabase";

export type CalendarWorkout = {
  workout_id: string;
  type: string | null;
  notes: string | null;
};

export type CalendarDay = {
  date: string;
  status: "planned" | "completed" | "skipped";
  workouts: CalendarWorkout[];
};

type MonthCalendarResponse = {
  ok?: boolean;
  active_plan_id?: string | null;
  days?: CalendarDay[] | null;
};

export function useMonthlyCalendar(userId: string | null, year: number, month: number) {
  const monthString = useMemo(() => {
    const normalizedMonth = month + 1; // convert 0-indexed -> human readable
    const formattedMonth = normalizedMonth.toString().padStart(2, "0");
    return `${year}-${formattedMonth}`;
  }, [year, month]);

  const shouldFetch = isSupabaseConfigured && !!userId;

  const { data, error, isFetching, isLoading, refetch } = useQuery<CalendarDay[], Error>({
    queryKey: ["month_calendar", userId ?? "anonymous", monthString],
    enabled: shouldFetch,
    staleTime: 1000 * 60,
    queryFn: async () => {
      if (!userId) {
        console.warn("[useMonthlyCalendar] Query attempted without authenticated user");
        return [];
      }
      const { data, error } = await supabase.functions.invoke<MonthCalendarResponse>("month_calendar", {
        body: {
          user_id: userId,
          month: monthString,
        },
      });
      if (error) {
        console.error("[useMonthlyCalendar] month_calendar error", error);
        throw error;
      }
      if (!data || data.ok === false) {
        return [];
      }
      return Array.isArray(data.days) ? data.days : [];
    },
  });

  return {
    days: data ?? [],
    loading: isFetching || isLoading,
    error,
    refetch,
  };
}
