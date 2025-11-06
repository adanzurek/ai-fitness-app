export type WorkoutType = "Push" | "Pull" | "Legs" | "Upper" | "Lower" | "Full Body" | "Rest";

export type Exercise = {
  id: string;
  name: string;
  sets: number;
  reps: string;
  weight?: number;
  notes?: string;
  completed: boolean;
};

export type Workout = {
  id: string;
  date: string;
  type: WorkoutType;
  title: string;
  description: string;
  exercises: Exercise[];
  completed: boolean;
  duration?: number;
};

export type Goal = {
  id: string;
  exercise: string;
  current: number;
  target: number;
  unit: "lbs" | "kg";
};

export type UserProfile = {
  name: string;
  goals: Goal[];
  streak: number;
  lastWorkoutDate?: string;
};

export type DayType = "workout" | "rest" | "meal-prep" | "completed";

export type CalendarDay = {
  date: string;
  type: DayType;
  workout?: Workout;
  label?: string;
};

export type Macros = {
  calories: number;
  protein: number;
  carbs: number;
  fats: number;
};

export type MealPlan = {
  id: string;
  date: string;
  meals: {
    id: string;
    name: string;
    time: string;
    macros: Macros;
  }[];
  totalMacros: Macros;
};
