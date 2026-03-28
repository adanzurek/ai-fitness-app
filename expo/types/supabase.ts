export type FitnessLevel = "beginner" | "intermediate" | "advanced";
export type FitnessGoalType = "strength" | "look_better" | "build_muscle" | "lose_fat" | "custom";

export type WeekdayName =
  | "monday"
  | "tuesday"
  | "wednesday"
  | "thursday"
  | "friday"
  | "saturday"
  | "sunday";

export interface ProfileSchedule {
  training_days_per_week?: number;
  training_day_names?: WeekdayName[];
  [key: string]: unknown;
}

export interface Profile {
  id: string;
  full_name: string | null;
  goals: string | null;
  experience_level: FitnessLevel | null;
  schedule: ProfileSchedule | null;
  equipment: string[] | null;
  plan: string | null;
  created_at?: string | null;
}

export interface Workout {
  id: string;
  user_id: string;
  date: string;
  block: string;
  notes: string | null;
}

export interface Session {
  id: string;
  user_id: string;
  workout_id: string;
  lift: string;
  sets: number;
  reps: number[];
  weight: number[];
  rpe: number[];
  started_at: string;
  ended_at: string | null;
}

export interface Goal {
  id: string;
  user_id: string;
  lift: string;
  target_1rm: number;
  target_date: string;
}
