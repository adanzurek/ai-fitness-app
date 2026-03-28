import type { FitnessGoalType, FitnessLevel, WeekdayName } from "@/types/supabase";

export type FitnessLevelOption = {
  label: string;
  value: FitnessLevel;
  description: string;
};

export type GoalOption = {
  label: string;
  value: FitnessGoalType;
  blurb: string;
};

export const fitnessLevelOptions: FitnessLevelOption[] = [
  { label: "Beginner", value: "beginner", description: "0-1 years of consistent training" },
  { label: "Intermediate", value: "intermediate", description: "1-3 years pushing for progress" },
  { label: "Advanced", value: "advanced", description: "3+ years, chasing performance" },
];

export const goalOptions: GoalOption[] = [
  { label: "Strength", value: "strength", blurb: "Hit new PRs and power numbers" },
  { label: "Look Better", value: "look_better", blurb: "Dial in aesthetics and definition" },
  { label: "Build Muscle", value: "build_muscle", blurb: "Pack on lean size strategically" },
  { label: "Lose Fat", value: "lose_fat", blurb: "Trim down while staying strong" },
  { label: "Custom Goal", value: "custom", blurb: "Define your own mission" },
];

export type WeekdayOption = {
  value: WeekdayName;
  label: string;
  shortLabel: string;
};

export const weekdayOptions: WeekdayOption[] = [
  { value: "monday", label: "Monday", shortLabel: "Mon" },
  { value: "tuesday", label: "Tuesday", shortLabel: "Tue" },
  { value: "wednesday", label: "Wednesday", shortLabel: "Wed" },
  { value: "thursday", label: "Thursday", shortLabel: "Thu" },
  { value: "friday", label: "Friday", shortLabel: "Fri" },
  { value: "saturday", label: "Saturday", shortLabel: "Sat" },
  { value: "sunday", label: "Sunday", shortLabel: "Sun" },
];

export const weekdayValueOrder = weekdayOptions.map((option) => option.value);

const weekdayValueSet = new Set<WeekdayName>(weekdayValueOrder);

export const isWeekdayValue = (value: unknown): value is WeekdayName =>
  typeof value === "string" && weekdayValueSet.has(value as WeekdayName);

export const sortWeekdays = (days: WeekdayName[]) => {
  const normalized = Array.from(
    new Set(days.filter((day): day is WeekdayName => weekdayValueSet.has(day))),
  );
  const normalizedSet = new Set(normalized);
  return weekdayValueOrder.filter((value) => normalizedSet.has(value));
};

export const defaultWeekdaysByCount = (count: number | null | undefined) => {
  if (typeof count !== "number" || count <= 0) {
    return [] as WeekdayName[];
  }
  const clamped = Math.min(count, weekdayValueOrder.length);
  return weekdayValueOrder.slice(0, clamped);
};
