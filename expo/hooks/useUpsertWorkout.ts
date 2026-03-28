import { supabase } from '@/lib/supabase';

export function useUpsertWorkout() {
  return async (payload: {
    id?: string;
    date: string;
    block: string;
    notes?: string;
    user_id: string;
  }) => {
    return supabase.from('workouts').upsert(payload, { onConflict: 'id' });
  };
}
