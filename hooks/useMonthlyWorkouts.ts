import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { useSupabaseUser } from './useSupabaseUser';

export type CalendarWorkout = {
  workout_id: string;
  type: string | null;
  notes: string | null;
};

export type CalendarDay = {
  date: string;
  status: 'planned' | 'completed' | 'skipped';
  workouts: CalendarWorkout[];
};

type MonthCalendarResponse = {
  ok: boolean;
  days: CalendarDay[];
};

interface UseMonthlyWorkoutsParams {
  year: number;
  month: number;
}

export function useMonthlyWorkouts({ year, month }: UseMonthlyWorkoutsParams) {
  const { user, loading: userLoading } = useSupabaseUser();
  const userId = user?.id ?? null;

  const monthString = useMemo(() => {
    const normalizedMonth = month + 1;
    const formattedMonth = normalizedMonth.toString().padStart(2, '0');
    return `${year}-${formattedMonth}`;
  }, [year, month]);

  const shouldFetch = isSupabaseConfigured && !!userId;

  if (!shouldFetch) {
    console.log('[useMonthlyWorkouts] Skipping fetch. Supabase configured:', isSupabaseConfigured, 'userId present:', !!userId);
  }

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
        `[useMonthlyWorkouts] invoking month_calendar for user ${userId} @ ${monthString}`
      );

      const { data: response, error: invokeError } = await supabase.functions.invoke<MonthCalendarResponse>(
        'month_calendar',
        {
          body: {
            user_id: userId,
            month: monthString,
          },
        }
      );

      if (invokeError) {
        console.error('[useMonthlyWorkouts] edge function error', invokeError);
        throw invokeError;
      }

      if (!response?.ok) {
        console.error('[useMonthlyWorkouts] edge function returned not ok', response);
        throw new Error('Unable to load workouts for this month');
      }

      console.log(
        `[useMonthlyWorkouts] received ${response.days?.length ?? 0} day entries for ${monthString}`
      );

      return response.days ?? [];
    },
  });

  const sortedDays = useMemo(() => {
    if (!data) {
      return [] as CalendarDay[];
    }

    return [...data].sort((a, b) => a.date.localeCompare(b.date));
  }, [data]);

  return {
    days: sortedDays,
    loading: userLoading || isFetching || isLoading,
    error,
    refetch,
    monthString,
  };
}
