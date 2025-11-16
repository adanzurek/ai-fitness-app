import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase, isSupabaseConfigured } from "@/lib/supabase";
import { useSupabaseUser } from "@/hooks/useSupabaseUser";

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

interface UseMonthlyWorkoutsParams {
  year: number;
  month: number; // 0-indexed
}

type WorkoutRow = {
  id: string;
  workout_date: string | null;
  type: string | null;
  notes: string | null;
  completed?: boolean | null;
};

function toISODateUTC(date: Date) {
  return date.toISOString().split("T")[0];
}

function startOfWeekUTC(date: Date) {
  const copy = new Date(date);
  const day = copy.getUTCDay();
  copy.setUTCDate(copy.getUTCDate() - day);
  return copy;
}

function endOfWeekUTC(date: Date) {
  const copy = new Date(date);
  const day = copy.getUTCDay();
  copy.setUTCDate(copy.getUTCDate() + (6 - day));
  return copy;
}

function getCalendarRange(year: number, month: number) {
  const monthStart = new Date(Date.UTC(year, month, 1));
  const monthEnd = new Date(Date.UTC(year, month + 1, 0));
  const rangeStart = startOfWeekUTC(monthStart);
  const rangeEnd = endOfWeekUTC(monthEnd);
  return {
    startISO: toISODateUTC(rangeStart),
    endISO: toISODateUTC(rangeEnd),
  };
}

export function useMonthlyWorkouts({ year, month }: UseMonthlyWorkoutsParams) {
  const { user, loading: userLoading } = useSupabaseUser();
  const userId = user?.id ?? null;

  const monthString = useMemo(() => {
    const normalizedMonth = month + 1; // convert 0-indexed -> human readable
    const formattedMonth = normalizedMonth.toString().padStart(2, '0');
    return `${year}-${formattedMonth}`;
  }, [year, month]);

  const calendarRange = useMemo(() => getCalendarRange(year, month), [year, month]);

  const shouldFetch = isSupabaseConfigured && !!userId;

  const { data, error, isFetching, isLoading, refetch } = useQuery<CalendarDay[], Error>({
    queryKey: ['month_calendar', userId ?? 'anonymous', monthString],
    enabled: shouldFetch,
    staleTime: 1000 * 60,
    queryFn: async () => {
      if (!userId) {
        console.warn('[useMonthlyWorkouts] Query attempted without authenticated user');
        return [];
      }

      console.log(
        `[useMonthlyWorkouts] querying workouts for ${userId} between ${calendarRange.startISO} and ${calendarRange.endISO}`
      );

      const fetchRows = async (withCompletedColumn: boolean) => {
        const selectFields = withCompletedColumn
          ? 'id, workout_date, type, notes, completed'
          : 'id, workout_date, type, notes';
        return supabase
          .from('workouts')
          .select(selectFields)
          .eq('user_id', userId)
          .gte('workout_date', calendarRange.startISO)
          .lte('workout_date', calendarRange.endISO)
          .order('workout_date', { ascending: true });
      };

      let { data: rows, error: queryError } = await fetchRows(true);

      if (queryError && queryError.code === '42703') {
        console.warn(
          "[useMonthlyWorkouts] 'completed' column missing, retrying without it"
        );
        const fallback = await fetchRows(false);
        rows = fallback.data;
        queryError = fallback.error;
      }

      if (queryError) {
        console.error('[useMonthlyWorkouts] workouts query failed', queryError);
        throw queryError;
      }

      const workoutRows = Array.isArray(rows) ? (rows as unknown as WorkoutRow[]) : [];

      if (workoutRows.length === 0) {
        return [];
      }

      const grouped = workoutRows.reduce<Record<string, { workouts: CalendarWorkout[]; completed: number; total: number }>>(
        (acc, row: WorkoutRow) => {
          if (!row.workout_date) {
            return acc;
          }
          if (!acc[row.workout_date]) {
            acc[row.workout_date] = {
              workouts: [],
              completed: 0,
              total: 0,
            };
          }
          acc[row.workout_date].workouts.push({
            workout_id: row.id,
            type: row.type ?? null,
            notes: row.notes ?? null,
          });
          acc[row.workout_date].total += 1;
          if (row.completed) {
            acc[row.workout_date].completed += 1;
          }
          return acc;
        },
        {}
      );

      return Object.entries(grouped)
        .map(([date, details]) => {
          const status: CalendarDay['status'] =
            details.completed >= details.total && details.total > 0 ? 'completed' : 'planned';
          return {
            date,
            status,
            workouts: details.workouts,
          };
        })
        .sort((a, b) => a.date.localeCompare(b.date));
    },
  });

  const days = (data ?? []) as CalendarDay[];

  return {
    days,
    loading: userLoading || isFetching || isLoading,
    error,
    refetch,
    monthString,
  };
}
