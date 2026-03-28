import { Workout, WorkoutType } from "@/types/fitness";

const today = new Date();
const tomorrow = new Date(today);
tomorrow.setDate(tomorrow.getDate() + 1);
const dayAfterTomorrow = new Date(today);
dayAfterTomorrow.setDate(dayAfterTomorrow.getDate() + 2);

export const sampleWorkouts: Workout[] = [
  {
    id: "1",
    date: today.toISOString().split("T")[0],
    type: "Push" as WorkoutType,
    title: "Push Day - Chest & Triceps",
    description: "Focus on 3 working sets at 75% of your max",
    exercises: [
      {
        id: "1",
        name: "Barbell Bench Press",
        sets: 4,
        reps: "6-8",
        weight: 185,
        completed: false,
      },
      {
        id: "2",
        name: "Incline Dumbbell Press",
        sets: 3,
        reps: "8-10",
        weight: 70,
        completed: false,
      },
      {
        id: "3",
        name: "Cable Flyes",
        sets: 3,
        reps: "12-15",
        weight: 40,
        completed: false,
      },
      {
        id: "4",
        name: "Tricep Dips",
        sets: 3,
        reps: "8-10",
        completed: false,
      },
      {
        id: "5",
        name: "Overhead Tricep Extension",
        sets: 3,
        reps: "10-12",
        weight: 50,
        completed: false,
      },
    ],
    completed: false,
  },
  {
    id: "2",
    date: tomorrow.toISOString().split("T")[0],
    type: "Pull" as WorkoutType,
    title: "Pull Day - Back & Biceps",
    description: "Compound movements first for maximum strength gains",
    exercises: [
      {
        id: "1",
        name: "Deadlift",
        sets: 4,
        reps: "5-6",
        weight: 275,
        completed: false,
      },
      {
        id: "2",
        name: "Pull-ups",
        sets: 3,
        reps: "8-10",
        completed: false,
      },
      {
        id: "3",
        name: "Barbell Rows",
        sets: 4,
        reps: "8-10",
        weight: 155,
        completed: false,
      },
      {
        id: "4",
        name: "Barbell Curls",
        sets: 3,
        reps: "10-12",
        weight: 75,
        completed: false,
      },
    ],
    completed: false,
  },
  {
    id: "3",
    date: dayAfterTomorrow.toISOString().split("T")[0],
    type: "Legs" as WorkoutType,
    title: "Leg Day - Quads & Hamstrings",
    description: "High volume for lower body development",
    exercises: [
      {
        id: "1",
        name: "Barbell Squat",
        sets: 4,
        reps: "6-8",
        weight: 225,
        completed: false,
      },
      {
        id: "2",
        name: "Romanian Deadlift",
        sets: 3,
        reps: "8-10",
        weight: 185,
        completed: false,
      },
      {
        id: "3",
        name: "Leg Press",
        sets: 3,
        reps: "10-12",
        weight: 360,
        completed: false,
      },
      {
        id: "4",
        name: "Leg Curls",
        sets: 3,
        reps: "12-15",
        weight: 90,
        completed: false,
      },
    ],
    completed: false,
  },
];
