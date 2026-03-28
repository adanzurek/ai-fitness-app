import createContextHook from "@nkzw/create-context-hook";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useState, useEffect, useMemo, useCallback } from "react";
import { Workout, UserProfile, Goal, MealPlan } from "@/types/fitness";
import { sampleWorkouts } from "@/constants/workouts";

const STORAGE_KEYS = {
  USER_PROFILE: "rork_user_profile",
  WORKOUTS: "rork_workouts",
  MEAL_PLANS: "rork_meal_plans",
} as const;

const defaultUserProfile: UserProfile = {
  name: "Champion",
  goals: [
    { id: "1", exercise: "Bench Press", current: 185, target: 225, unit: "lbs" },
    { id: "2", exercise: "Squat", current: 225, target: 315, unit: "lbs" },
    { id: "3", exercise: "Deadlift", current: 275, target: 405, unit: "lbs" },
  ],
  streak: 7,
  lastWorkoutDate: undefined,
  fitnessLevel: null,
  trainingDaysPerWeek: null,
  preferredTrainingDays: null,
  primaryGoalType: null,
  primaryGoalCustom: null,
};

const sanitizeUserProfileValue = (input: unknown): UserProfile => {
  if (!input || typeof input !== "object") {
    return defaultUserProfile;
  }
  const candidate = input as Partial<UserProfile>;
  const goals = Array.isArray(candidate.goals) ? candidate.goals : defaultUserProfile.goals;
  return {
    ...defaultUserProfile,
    ...candidate,
    goals,
  };
};

export const [FitnessContext, useFitness] = createContextHook(() => {
  const [userProfile, setUserProfile] = useState<UserProfile>(defaultUserProfile);
  const [workouts, setWorkouts] = useState<Workout[]>(sampleWorkouts);
  const [mealPlans, setMealPlans] = useState<MealPlan[]>([]);

  const userProfileQuery = useQuery({
    queryKey: ["userProfile"],
    queryFn: async () => {
      const stored = await AsyncStorage.getItem(STORAGE_KEYS.USER_PROFILE);
      return stored ? sanitizeUserProfileValue(JSON.parse(stored)) : defaultUserProfile;
    },
  });

  const workoutsQuery = useQuery({
    queryKey: ["workouts"],
    queryFn: async () => {
      const stored = await AsyncStorage.getItem(STORAGE_KEYS.WORKOUTS);
      return stored ? JSON.parse(stored) : sampleWorkouts;
    },
  });

  const mealPlansQuery = useQuery({
    queryKey: ["mealPlans"],
    queryFn: async () => {
      const stored = await AsyncStorage.getItem(STORAGE_KEYS.MEAL_PLANS);
      return stored ? JSON.parse(stored) : [];
    },
  });

  const { mutate: mutateUserProfile } = useMutation({
    mutationFn: async (profile: UserProfile) => {
      await AsyncStorage.setItem(STORAGE_KEYS.USER_PROFILE, JSON.stringify(profile));
      return profile;
    },
  });

  const { mutate: mutateWorkouts } = useMutation({
    mutationFn: async (workouts: Workout[]) => {
      await AsyncStorage.setItem(STORAGE_KEYS.WORKOUTS, JSON.stringify(workouts));
      return workouts;
    },
  });

  const { mutate: mutateMealPlans } = useMutation({
    mutationFn: async (plans: MealPlan[]) => {
      await AsyncStorage.setItem(STORAGE_KEYS.MEAL_PLANS, JSON.stringify(plans));
      return plans;
    },
  });

  useEffect(() => {
    if (userProfileQuery.data) {
      setUserProfile(userProfileQuery.data);
    }
  }, [userProfileQuery.data]);

  useEffect(() => {
    if (workoutsQuery.data) {
      setWorkouts(workoutsQuery.data);
    }
  }, [workoutsQuery.data]);

  useEffect(() => {
    if (mealPlansQuery.data) {
      setMealPlans(mealPlansQuery.data);
    }
  }, [mealPlansQuery.data]);

  const updateUserProfile = useCallback((profile: UserProfile) => {
    const sanitized = sanitizeUserProfileValue(profile);
    setUserProfile(sanitized);
    mutateUserProfile(sanitized);
  }, [mutateUserProfile]);

  const updateWorkout = useCallback((workoutId: string, updates: Partial<Workout>) => {
    setWorkouts((prev) => {
      const updatedWorkouts = prev.map((w) =>
        w.id === workoutId ? { ...w, ...updates } : w
      );
      mutateWorkouts(updatedWorkouts);
      return updatedWorkouts;
    });
  }, [mutateWorkouts]);

  const toggleExerciseComplete = useCallback((workoutId: string, exerciseId: string) => {
    setWorkouts((prev) => {
      const updatedWorkouts = prev.map((w) => {
        if (w.id === workoutId) {
          return {
            ...w,
            exercises: w.exercises.map((e) =>
              e.id === exerciseId ? { ...e, completed: !e.completed } : e
            ),
          };
        }
        return w;
      });
      mutateWorkouts(updatedWorkouts);
      return updatedWorkouts;
    });
  }, [mutateWorkouts]);

  const addWorkout = useCallback((workout: Workout) => {
    setWorkouts((prev) => {
      const updatedWorkouts = [...prev, workout];
      mutateWorkouts(updatedWorkouts);
      return updatedWorkouts;
    });
  }, [mutateWorkouts]);

  const addMealPlan = useCallback((plan: MealPlan) => {
    setMealPlans((prev) => {
      const updatedPlans = [...prev, plan];
      mutateMealPlans(updatedPlans);
      return updatedPlans;
    });
  }, [mutateMealPlans]);

  const updateGoal = useCallback((goalId: string, updates: Partial<Goal>) => {
    const updatedProfile: UserProfile = {
      ...userProfile,
      goals: userProfile.goals.map((g) => (g.id === goalId ? { ...g, ...updates } : g)),
    };
    updateUserProfile(updatedProfile);
  }, [userProfile, updateUserProfile]);

  return useMemo(() => ({
    userProfile,
    workouts,
    mealPlans,
    updateUserProfile,
    updateWorkout,
    toggleExerciseComplete,
    addWorkout,
    addMealPlan,
    updateGoal,
    isLoading: userProfileQuery.isLoading || workoutsQuery.isLoading || mealPlansQuery.isLoading,
  }), [
    userProfile,
    workouts,
    mealPlans,
    updateUserProfile,
    updateWorkout,
    toggleExerciseComplete,
    addWorkout,
    addMealPlan,
    updateGoal,
    userProfileQuery.isLoading,
    workoutsQuery.isLoading,
    mealPlansQuery.isLoading,
  ]);
});

export function useTodaysWorkout() {
  const { workouts } = useFitness();
  const today = new Date().toISOString().split("T")[0];
  return useMemo(
    () => workouts.find((w) => w.date === today),
    [workouts, today]
  );
}

export function useUpcomingWorkouts() {
  const { workouts } = useFitness();
  const today = new Date().toISOString().split("T")[0];
  return useMemo(
    () => workouts.filter((w) => w.date >= today).sort((a, b) => a.date.localeCompare(b.date)),
    [workouts, today]
  );
}
