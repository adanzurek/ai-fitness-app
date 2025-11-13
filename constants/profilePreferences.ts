import type { FitnessGoalType, FitnessLevel } from "@/types/supabase";

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

export const trainingDayOptions: number[] = [2, 3, 4, 5, 6, 7];

export const goalOptions: GoalOption[] = [
  { label: "Strength", value: "strength", blurb: "Hit new PRs and power numbers" },
  { label: "Look Better", value: "look_better", blurb: "Dial in aesthetics and definition" },
  { label: "Build Muscle", value: "build_muscle", blurb: "Pack on lean size strategically" },
  { label: "Lose Fat", value: "lose_fat", blurb: "Trim down while staying strong" },
  { label: "Custom Goal", value: "custom", blurb: "Define your own mission" },
];
