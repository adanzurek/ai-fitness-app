import { useEffect, useState } from 'react';
import { supabase, isSupabaseConfigured } from '@/lib/supabase';
import { Workout } from '@/types/supabase';

export function useMonthlyWorkouts({ year, month }: { year: number; month: number }) {
  const [rows, setRows] = useState<Workout[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const from = new Date(year, month - 1, 1).toISOString().slice(0, 10);
    const to = new Date(year, month, 0).toISOString().slice(0, 10);
    let alive = true;

    (async () => {
      setLoading(true);

      if (!isSupabaseConfigured) {
        if (!alive) return;
        setRows([]);
        setLoading(false);
        return;
      }

      const { data, error } = await supabase
        .from('workouts')
        .select('id, user_id, date, block, notes')
        .gte('date', from)
        .lte('date', to)
        .order('date');

      if (!alive) return;
      setRows(error ? [] : (data ?? []));
      setLoading(false);
    })();

    return () => {
      alive = false;
    };
  }, [year, month]);

  return { rows, loading };
}
