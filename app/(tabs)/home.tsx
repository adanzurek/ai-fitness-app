import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Animated,
  Easing,
  Modal,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  ViewStyle,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useFocusEffect } from "@react-navigation/native";
import { useRouter } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import { Calendar, Flame, Sparkles, Dumbbell, Wand2, ArrowRight } from "lucide-react-native";
import Colors from "../../constants/colors";
import { supabase } from "../../lib/supabase";
import type { ProfileSchedule } from "../../types/supabase";
import { useSupabaseUser } from "../../hooks/useSupabaseUser";

type ProfileData = {
  id: string;
  full_name: string | null;
  experience_level: string | null;
  schedule: ProfileSchedule | null;
};

type PlanData = {
  id: string;
  name: string | null;
  status?: string | null;
  created_at: string;
};

type HomeWorkout = {
  id: string;
  type: string | null;
  workout_date: string;
  notes?: string | null;
  sets: HomeWorkoutSet[];
};

type HomeWorkoutSet = {
  id: string;
  set_id: string;
  set_no: number | null;
  exercise_id: string | null;
  exercise_name: string;
  reps?: number | null;
  intensity?: number | null;
  target_load?: number | null;
  load?: number | null;
  amrap?: boolean | null;
};

type ComposeTodayWorkout = {
  workout_id?: string | null;
  type?: string | null;
  notes?: string | null;
  workout_date?: string;
  sets?: ComposeTodaySet[] | null;
};

type ComposeTodayResponse = {
  ok?: boolean;
  code?: string;
  workout?: ComposeTodayWorkout | null;
  workout_id?: string | null;
};

type ComposeTodaySet = {
  set_id?: string | null;
  set_no?: number | null;
  exercise_id?: string | null;
  exercise_name?: string | null;
  reps?: number | null;
  intensity?: number | null;
  target_load?: number | null;
  load?: number | null;
  amrap?: boolean | null;
};

type ExerciseResultType = "unlogged" | "completed" | "missed" | "adjusted_weight" | "skipped";

type ExerciseState = {
  exercise_id: string;
  exercise_name: string;
  num_sets: number;
  target_reps: number;
  target_load: number | null;
  result_type: ExerciseResultType;
  reps_missed_total?: number;
  weight_delta?: number;
};

type SetResultRecord = {
  set_id: string;
  achieved_reps: number;
  achieved_load: number | null;
  rpe: number | null;
  completed: boolean;
  notes: string | null;
};

type ExerciseGroup = {
  exercise_id: string;
  exercise_name: string;
  num_sets: number;
  target_reps: number;
  target_load: number | null;
  sets: HomeWorkoutSet[];
};

type GoalProgress = {
  id: string;
  name: string;
  progress: number;
  current: number;
  target: number;
  unit: string;
};

type SupabaseGoalRow = {
  exercise_id: string;
  target_tm: number | null;
  unit?: string | null;
};

type SupabaseTmRow = {
  exercise_id: string;
  training_max: number | null;
  created_at: string;
};

type TodaySectionProps = {
  loading: boolean;
  planLoading: boolean;
  hasPlan: boolean;
  isRestDay: boolean;
  workout: HomeWorkout | null;
  onPressGeneratePlan: () => void;
  generatingPlan: boolean;
  scheduleDays: number;
  error: string | null;
  exerciseGroups: ExerciseGroup[];
  exerciseStates: Record<string, ExerciseState>;
  onSelectResult: (exerciseId: string, updates: Partial<ExerciseState>) => void;
  onFinishWorkout: () => void;
  finishingWorkout: boolean;
  workoutCompleted: boolean;
  profile: ProfileData | null;
  hasLoggedExercise: boolean;
};

type HeaderUserGreetingProps = {
  loading: boolean;
  profile: ProfileData | null;
  onPressProfile: () => void;
};

type StreakCardProps = {
  loading: boolean;
  streak: number;
};

type GoalsSectionProps = {
  loading: boolean;
  goals: GoalProgress[];
};

type GoalCardProps = {
  goal: GoalProgress;
};

type SkeletonBlockProps = {
  width: number | `${number}%`;
  height: number;
  borderRadius: number;
  style?: ViewStyle;
};

const GOAL_EXERCISES = [
  { id: "bench_press", name: "Bench Press", unit: "lbs" },
  { id: "back_squat", name: "Back Squat", unit: "lbs" },
  { id: "deadlift", name: "Deadlift", unit: "lbs" },
];

const DEFAULT_SCHEDULE_DAYS = 4;

class HomeErrorBoundary extends React.Component<{ children: React.ReactNode }, { hasError: boolean }> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error: Error) {
    console.log("[Home] Error boundary caught", error);
  }

  render() {
    if (this.state.hasError) {
      return (
        <View style={styles.errorContainer}>
          <Text style={styles.errorTitle}>Something went wrong</Text>
          <Text style={styles.errorSubtitle}>Please restart the app and try again.</Text>
        </View>
      );
    }
    return this.props.children as React.ReactElement;
  }
}

export default function HomeScreen() {
  return (
    <HomeErrorBoundary>
      <HomeScreenContent />
    </HomeErrorBoundary>
  );
}

function HomeScreenContent() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user, loading: userLoading } = useSupabaseUser();
  const userId = user?.id ?? null;
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [generatingPlan, setGeneratingPlan] = useState<boolean>(false);

  const {
    profile,
    loading: profileLoading,
    refresh: refreshProfile,
  } = useUserProfile(userId);

  const {
    plan,
    loading: planLoading,
    refresh: refreshPlan,
  } = useCurrentPlan(userId);

  const {
    todayWorkout,
    isRestDay,
    loading: workoutLoading,
    error: todayError,
    refresh: refreshTodayWorkout,
    composeTodayWorkout,
  } = useTodayWorkout(userId);

  const exerciseGroups = useMemo(
    () => groupWorkoutSets(todayWorkout?.sets ?? []),
    [todayWorkout?.sets],
  );
  const [exerciseStates, setExerciseStates] = useState<Record<string, ExerciseState>>({});
  const [finishingWorkout, setFinishingWorkout] = useState<boolean>(false);
  const [workoutCompleted, setWorkoutCompleted] = useState<boolean>(false);
  const hasAnyLoggedExercise = useMemo(
    () => Object.values(exerciseStates).some((state) => state.result_type !== "unlogged"),
    [exerciseStates],
  );

  useEffect(() => {
    if (!exerciseGroups.length) {
      setExerciseStates({});
      setWorkoutCompleted(false);
      return;
    }
    const defaults = exerciseGroups.reduce<Record<string, ExerciseState>>((acc, group) => {
      acc[group.exercise_id] = createDefaultExerciseStateFromGroup(group);
      return acc;
    }, {});
    setExerciseStates(defaults);
    setWorkoutCompleted(false);
  }, [exerciseGroups]);

  const handleExerciseStateChange = useCallback(
    (exerciseId: string, updates: Partial<ExerciseState>) => {
      setExerciseStates((prev) => {
        const existing = prev[exerciseId];
        if (!existing) {
          return prev;
        }
        return {
          ...prev,
          [exerciseId]: {
            ...existing,
            ...updates,
          },
        };
      });
    },
    [],
  );

  const {
    streak,
    loading: streakLoading,
    refresh: refreshStreak,
  } = useUserStreak(userId);

  const {
    goals,
    loading: goalsLoading,
    refresh: refreshGoals,
  } = useUserGoals(userId);

  const scheduleDays = useMemo(() => {
    if (!profile?.schedule || typeof profile.schedule.training_days_per_week !== "number") {
      return DEFAULT_SCHEDULE_DAYS;
    }
    return profile.schedule.training_days_per_week || DEFAULT_SCHEDULE_DAYS;
  }, [profile]);

  const refreshAll = useCallback(async () => {
    if (!userId) {
      setRefreshing(false);
      return;
    }
    console.log("[Home] Refreshing all data for", userId);
    setRefreshing(true);
    await Promise.allSettled([
      refreshProfile(),
      refreshPlan(),
      refreshTodayWorkout(),
      refreshGoals(),
      refreshStreak(),
    ]);
    setRefreshing(false);
  }, [refreshGoals, refreshPlan, refreshProfile, refreshStreak, refreshTodayWorkout, userId]);

  useFocusEffect(
    useCallback(() => {
      console.log("[Home] Screen focused");
      if (userId) {
        refreshAll();
      }
    }, [refreshAll, userId]),
  );

  const handleGeneratePlan = useCallback(async () => {
    if (!userId) {
      Alert.alert("Sign in required", "Please sign in to generate a plan.");
      return;
    }
    console.log("[Home] Composing today's workout for", userId);
    setGeneratingPlan(true);
    try {
      await composeTodayWorkout();
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to generate today’s workout.";
      Alert.alert("Something went wrong", message);
    } finally {
      setGeneratingPlan(false);
    }
  }, [composeTodayWorkout, userId]);

  const handleProfilePress = useCallback(() => {
    console.log("[Home] Navigating to profile");
    router.push("/profile");
  }, [router]);

  const handleFinishWorkout = useCallback(async () => {
    if (!todayWorkout) {
      Alert.alert("No workout", "We couldn't find today's workout.");
      return;
    }
    if (!todayWorkout.sets.length) {
      Alert.alert("No sets", "There are no sets to submit.");
      return;
    }
    if (!hasAnyLoggedExercise) {
      Alert.alert("Log exercises", "Please log at least one exercise before finishing.");
      return;
    }
    try {
      setFinishingWorkout(true);
      const payload = buildFinishWorkoutPayload(todayWorkout, exerciseGroups, exerciseStates);
      console.log("[Home] finish_workout payload", JSON.stringify(payload, null, 2));
      const { data, error } = await supabase.functions.invoke("finish_workout", { body: payload });
      if (error) {
        console.error("[Home] finish_workout error", error);
        throw error;
      }
      if (!data || data.ok !== true) {
        throw new Error("finish_workout returned unexpected response");
      }
      console.log("[Home] finish_workout success", data);
      setWorkoutCompleted(true);
      Alert.alert("Workout saved", "Nice work — workout saved.");
    } catch (err) {
      console.error("[Home] Unable to finish workout", err);
      Alert.alert("Could not finish workout", "Please try again.");
    } finally {
      setFinishingWorkout(false);
    }
  }, [exerciseGroups, exerciseStates, hasAnyLoggedExercise, todayWorkout]);

  if (userLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={Colors.primary} />
      </View>
    );
  }

  if (!userId) {
    return (
      <View style={styles.loadingContainer}>
        <Text style={styles.errorTitle}>Sign in required</Text>
        <Text style={styles.errorSubtitle}>We need you signed in to show your training data.</Text>
      </View>
    );
  }

  return (
    <View style={styles.screenContainer}>
      <ScrollView
        testID="home-scroll-view"
        style={styles.scrollView}
        contentContainerStyle={[
          styles.scrollContent,
          { paddingTop: insets.top + 12, paddingBottom: insets.bottom + 120 },
        ]}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={refreshAll}
            tintColor={Colors.primary}
            progressViewOffset={16}
          />
        }
        showsVerticalScrollIndicator={false}
      >
        <HeaderUserGreeting
          loading={profileLoading}
          profile={profile}
          onPressProfile={handleProfilePress}
        />
        <StreakCard loading={streakLoading} streak={streak} />
        <TodaySection
          loading={workoutLoading}
          planLoading={planLoading}
          hasPlan={Boolean(plan)}
          isRestDay={isRestDay}
          workout={todayWorkout}
          onPressGeneratePlan={handleGeneratePlan}
          generatingPlan={generatingPlan}
          scheduleDays={scheduleDays}
          error={todayError}
          exerciseGroups={exerciseGroups}
          exerciseStates={exerciseStates}
          onSelectResult={handleExerciseStateChange}
          onFinishWorkout={handleFinishWorkout}
          finishingWorkout={finishingWorkout}
          workoutCompleted={workoutCompleted}
          profile={profile}
          hasLoggedExercise={hasAnyLoggedExercise}
        />
        <GoalsSection loading={goalsLoading} goals={goals} />
      </ScrollView>
    </View>
  );
}

function HeaderUserGreeting({ loading, profile, onPressProfile }: HeaderUserGreetingProps) {
  return (
    <View style={styles.header}>
      <View style={styles.headerCopy}>
        {loading ? (
          <SkeletonBlock width={180} height={32} borderRadius={12} style={styles.headerSkeleton} />
        ) : (
          <Text style={styles.greeting}>Hi {profile?.full_name?.split(" ")[0] ?? "Champion"} 👋</Text>
        )}
        {loading ? (
          <SkeletonBlock width={150} height={16} borderRadius={8} />
        ) : (
          <Text style={styles.subtitle}>Ready to crush today?</Text>
        )}
      </View>
      <Pressable
        onPress={onPressProfile}
        style={({ pressed }) => [styles.profileButton, pressed && styles.profileButtonPressed]}
        testID="profile-button"
      >
        <Wand2 color={Colors.text} size={20} />
      </Pressable>
    </View>
  );
}

function StreakCard({ loading, streak }: StreakCardProps) {
  return (
    <View style={styles.streakCard} testID="streak-card">
      <LinearGradient
        colors={["#8F1A1A", Colors.primary]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.streakGradient}
      >
        <View style={styles.streakIconWrap}>
          <Flame color={Colors.text} size={28} />
        </View>
        {loading ? (
          <SkeletonBlock width={80} height={52} borderRadius={16} style={styles.streakSkeleton} />
        ) : (
          <Text style={styles.streakNumber}>{streak}</Text>
        )}
        <Text style={styles.streakLabel}>Day Streak</Text>
        <Text style={styles.streakSubtext}>Keep it going!</Text>
      </LinearGradient>
    </View>
  );
}

function TodaySection({
  loading,
  planLoading,
  hasPlan,
  isRestDay,
  workout,
  onPressGeneratePlan,
  generatingPlan,
  scheduleDays,
  error,
  exerciseGroups,
  exerciseStates,
  onSelectResult,
  onFinishWorkout,
  finishingWorkout,
  workoutCompleted,
  profile,
  hasLoggedExercise,
}: TodaySectionProps) {
  const firstName = profile?.full_name?.split(" ")[0] ?? "Athlete";
  const formattedDate = workout?.workout_date
    ? new Date(workout.workout_date).toLocaleDateString("en-US", {
        weekday: "long",
        month: "long",
        day: "numeric",
      })
    : null;
  const [missedExerciseId, setMissedExerciseId] = useState<string | null>(null);
  const [weightExerciseId, setWeightExerciseId] = useState<string | null>(null);
  const [customWeightInput, setCustomWeightInput] = useState("");
  const MISSED_REP_OPTIONS = [
    { label: "Missed 1 rep", value: 1 },
    { label: "Missed 2 reps", value: 2 },
    { label: "Missed 3+ reps", value: 3 },
  ];
  const WEIGHT_OPTIONS = [
    { label: "Same weight", value: 0 },
    { label: "-5 lb", value: -5 },
    { label: "-10 lb", value: -10 },
    { label: "Custom…", value: null },
  ];
  const activeMissedExercise = missedExerciseId ? exerciseStates[missedExerciseId] : undefined;
  const activeWeightExercise = weightExerciseId ? exerciseStates[weightExerciseId] : undefined;

  if (loading || planLoading) {
    return (
      <View style={styles.todayCard} testID="today-card-loading">
        <SkeletonBlock width={120} height={20} borderRadius={10} style={styles.todaySkeleton} />
        <SkeletonBlock width="100%" height={32} borderRadius={12} style={styles.todaySkeleton} />
        <SkeletonBlock width="60%" height={16} borderRadius={8} />
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.todayCard}>
        <Text style={styles.errorTitle}>Unable to load workout</Text>
        <Text style={styles.errorSubtitle}>{error}</Text>
      </View>
    );
  }

  if (isRestDay) {
    return (
      <View style={styles.todayCard} testID="rest-day-card">
        <View style={styles.restBadge}>
          <Sparkles color={Colors.text} size={22} />
        </View>
        <Text style={styles.restTitle}>Rest Day</Text>
        <Text style={styles.restText}>
          Recovery matters. Take a light walk or mobility work to stay primed.
        </Text>
      </View>
    );
  }

  if (!workout) {
    if (!hasPlan) {
      return (
        <View style={[styles.todayCard, styles.generatePlanCard]} testID="generate-plan-card">
          <View style={styles.generatePlanHeader}>
            <Sparkles color={Colors.primary} size={24} />
            <Text style={styles.generatePlanTitle}>No plan yet</Text>
          </View>
          <Text style={styles.generatePlanSubtitle}>
            Go to Coach or tap below to generate your first program.
          </Text>
          <TouchableOpacity
            activeOpacity={0.8}
            style={styles.generatePlanButton}
            onPress={onPressGeneratePlan}
            disabled={generatingPlan}
            testID="generate-plan-button"
          >
            {generatingPlan ? (
              <ActivityIndicator color={Colors.text} />
            ) : (
              <>
                <Text style={styles.generatePlanButtonText}>Generate Plan</Text>
                <ArrowRight color={Colors.text} size={18} />
              </>
            )}
          </TouchableOpacity>
          <Text style={styles.generatePlanFooter}>Suggested schedule: {scheduleDays} days</Text>
        </View>
      );
    }

    return (
      <View style={styles.todayCard}>
        <Text style={styles.workoutHeadline}>No workout scheduled</Text>
        <Text style={styles.workoutMeta}>Check back later for your next session.</Text>
      </View>
    );
  }

  const workoutNotesValue = workout.notes ?? "";
  const suggestedNotes =
    workoutNotesValue.trim().length > 0 ? workoutNotesValue : "Focus on crisp reps and steady tempo.";

  const handleCompleted = (exerciseId: string) => {
    onSelectResult(exerciseId, {
      result_type: "completed",
      reps_missed_total: 0,
      weight_delta: 0,
    });
  };

  const handleSkip = (exercise: ExerciseGroup) => {
    onSelectResult(exercise.exercise_id, {
      result_type: "skipped",
      reps_missed_total: exercise.target_reps * exercise.num_sets,
      weight_delta: 0,
    });
  };

  const handleMissedSelect = (value: number) => {
    if (!activeMissedExercise) {
      return;
    }
    onSelectResult(activeMissedExercise.exercise_id, {
      result_type: "missed",
      reps_missed_total: value,
      weight_delta: 0,
    });
    setMissedExerciseId(null);
  };

  const handleWeightSelect = (value: number | null) => {
    if (!activeWeightExercise) {
      return;
    }
    if (value === null) {
      return;
    }
    onSelectResult(activeWeightExercise.exercise_id, {
      result_type: "adjusted_weight",
      weight_delta: value,
      reps_missed_total: 0,
    });
    setWeightExerciseId(null);
    setCustomWeightInput("");
  };

  const handleCustomWeightSubmit = () => {
    if (!activeWeightExercise) {
      return;
    }
    const numeric = Number(customWeightInput);
    if (Number.isNaN(numeric)) {
      Alert.alert("Invalid weight", "Enter a valid number.");
      return;
    }
    onSelectResult(activeWeightExercise.exercise_id, {
      result_type: "adjusted_weight",
      weight_delta: numeric,
      reps_missed_total: 0,
    });
    setWeightExerciseId(null);
    setCustomWeightInput("");
  };

  return (
    <View style={styles.todayCard} testID="today-workout-card">
      <View style={styles.todayBadgeRow}>
        <View style={styles.todayBadgeIcon}>
          <Calendar size={16} color={Colors.text} />
          <Text style={styles.todayBadgeText}>Today&apos;s Workout</Text>
        </View>
      </View>
      <Text style={styles.greetingInline}>Hi {firstName} 👋</Text>
      <Text style={styles.workoutHeadline}>{workout.type ?? "Training Session"}</Text>
      <Text style={styles.workoutMeta}>{formattedDate ?? "Today"}</Text>
      <Text style={styles.workoutNotes}>{suggestedNotes}</Text>

      {exerciseGroups.length > 0 ? (
        <View style={styles.exerciseList}>
          {exerciseGroups.map((exercise) => {
            const state = exerciseStates[exercise.exercise_id];
            const resultType = state?.result_type ?? "unlogged";
            const subtitleParts = [`${exercise.num_sets} sets × ${exercise.target_reps} reps`];
            if (exercise.target_load != null) {
              subtitleParts.push(`@ ${exercise.target_load} lb`);
            }
            return (
              <View key={exercise.exercise_id} style={styles.exerciseCard}>
                <Text style={styles.exerciseTitle}>{exercise.exercise_name}</Text>
                <Text style={styles.exerciseSubtitle}>{subtitleParts.join(" ")}</Text>
                <View style={styles.exerciseButtonRow}>
                  <TouchableOpacity
                    style={[
                      styles.exerciseActionButton,
                      resultType === "completed" && styles.exerciseActionButtonActive,
                    ]}
                    onPress={() => handleCompleted(exercise.exercise_id)}
                  >
                    <Text
                      style={[
                        styles.exerciseActionLabel,
                        resultType === "completed" && styles.exerciseActionLabelActive,
                      ]}
                    >
                      Completed as written
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[
                      styles.exerciseActionButton,
                      resultType === "missed" && styles.exerciseActionButtonActive,
                    ]}
                    onPress={() => setMissedExerciseId(exercise.exercise_id)}
                  >
                    <Text
                      style={[
                        styles.exerciseActionLabel,
                        resultType === "missed" && styles.exerciseActionLabelActive,
                      ]}
                    >
                      Missed reps
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[
                      styles.exerciseActionButton,
                      resultType === "adjusted_weight" && styles.exerciseActionButtonActive,
                    ]}
                    onPress={() => setWeightExerciseId(exercise.exercise_id)}
                  >
                    <Text
                      style={[
                        styles.exerciseActionLabel,
                        resultType === "adjusted_weight" && styles.exerciseActionLabelActive,
                      ]}
                    >
                      Adjusted weight
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[
                      styles.exerciseActionButton,
                      resultType === "skipped" && styles.exerciseActionButtonActive,
                    ]}
                    onPress={() => handleSkip(exercise)}
                  >
                    <Text
                      style={[
                        styles.exerciseActionLabel,
                        resultType === "skipped" && styles.exerciseActionLabelActive,
                      ]}
                    >
                      Skipped exercise
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>
            );
          })}
        </View>
      ) : (
        <View style={styles.emptyCard}>
          <Text style={styles.emptyTitle}>No exercises assigned.</Text>
          <Text style={styles.emptySubtitle}>Your coach hasn&apos;t programmed sets for this day yet.</Text>
        </View>
      )}

      <TouchableOpacity
        activeOpacity={0.85}
        disabled={
          finishingWorkout || workoutCompleted || exerciseGroups.length === 0 || !hasLoggedExercise
        }
        onPress={onFinishWorkout}
        style={[
          styles.finishWorkoutButton,
          (finishingWorkout || workoutCompleted || exerciseGroups.length === 0 || !hasLoggedExercise) &&
            styles.finishWorkoutButtonDisabled,
        ]}
        testID="finish-workout-button"
      >
        {finishingWorkout ? (
          <ActivityIndicator color={Colors.background} />
        ) : (
          <Text style={styles.finishWorkoutButtonText}>
            {workoutCompleted ? "Workout completed" : "Finish workout"}
          </Text>
        )}
      </TouchableOpacity>

      <Modal
        visible={Boolean(missedExerciseId)}
        transparent
        animationType="slide"
        onRequestClose={() => setMissedExerciseId(null)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>
              {activeMissedExercise?.exercise_name ?? "Exercise"} · missed reps
            </Text>
            {MISSED_REP_OPTIONS.map((option) => (
              <TouchableOpacity
                key={option.value}
                style={styles.modalOption}
                onPress={() => handleMissedSelect(option.value)}
              >
                <Text style={styles.modalOptionText}>{option.label}</Text>
              </TouchableOpacity>
            ))}
            <TouchableOpacity style={styles.modalCancel} onPress={() => setMissedExerciseId(null)}>
              <Text style={styles.modalCancelText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      <Modal
        visible={Boolean(weightExerciseId)}
        transparent
        animationType="slide"
        onRequestClose={() => setWeightExerciseId(null)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>
              {activeWeightExercise?.exercise_name ?? "Exercise"} · adjust weight
            </Text>
            {WEIGHT_OPTIONS.map((option) =>
              option.value === null ? (
                <View key="custom" style={styles.modalCustom}>
                  <Text style={styles.modalOptionText}>Custom adjustment (lbs)</Text>
                  <TextInput
                    style={styles.modalInput}
                    keyboardType="numeric"
                    value={customWeightInput}
                    onChangeText={setCustomWeightInput}
                    placeholder="e.g. -7.5"
                    placeholderTextColor="rgba(255,255,255,0.4)"
                  />
                  <TouchableOpacity style={styles.modalConfirm} onPress={handleCustomWeightSubmit}>
                    <Text style={styles.modalConfirmText}>Apply</Text>
                  </TouchableOpacity>
                </View>
              ) : (
                <TouchableOpacity
                  key={option.value}
                  style={styles.modalOption}
                  onPress={() => handleWeightSelect(option.value)}
                >
                  <Text style={styles.modalOptionText}>{option.label}</Text>
                </TouchableOpacity>
              ),
            )}
            <TouchableOpacity style={styles.modalCancel} onPress={() => setWeightExerciseId(null)}>
              <Text style={styles.modalCancelText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}
function GoalsSection({ loading, goals }: GoalsSectionProps) {
  return (
    <View style={styles.goalsSection}>
      <View style={styles.goalsHeader}>
        <Text style={styles.goalsTitle}>Your Goals</Text>
        <Text style={styles.goalsSubtitle}>Micro wins build macro strength</Text>
      </View>
      {loading ? (
        <View>
          <SkeletonBlock width="100%" height={78} borderRadius={18} style={styles.goalSkeleton} />
          <SkeletonBlock width="100%" height={78} borderRadius={18} style={styles.goalSkeleton} />
        </View>
      ) : goals.length === 0 ? (
        <View style={styles.goalsEmpty}>
          <Text style={styles.goalsEmptyTitle}>Goals coming soon</Text>
          <Text style={styles.goalsEmptySubtitle}>
            Complete workouts with the coach to start tracking your training maxes.
          </Text>
        </View>
      ) : (
        goals.map((goal) => <GoalCard key={goal.id} goal={goal} />)
      )}
    </View>
  );
}

function GoalCard({ goal }: GoalCardProps) {
  const progressAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(progressAnim, {
      toValue: Math.min(goal.progress, 100),
      duration: 600,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    }).start();
  }, [goal.progress, progressAnim]);

  const progressWidth = progressAnim.interpolate({
    inputRange: [0, 100],
    outputRange: ["0%", "100%"],
  });

  const percentLabel = `${Math.round(Math.min(goal.progress, 999))}%`;

  return (
    <View style={styles.goalCard} testID={`goal-card-${goal.id}`}>
      <View style={styles.goalHeader}>
        <Text style={styles.goalExercise}>{goal.name}</Text>
        <Text style={styles.goalProgressLabel}>{percentLabel}</Text>
      </View>
      <View style={styles.goalBarTrack}>
        <Animated.View style={[styles.goalBarFill, { width: progressWidth }]} />
      </View>
      <View style={styles.goalStatsRow}>
        <Text style={styles.goalStat}>Current {goal.current} {goal.unit}</Text>
        <Text style={styles.goalStat}>Target {goal.target} {goal.unit}</Text>
      </View>
    </View>
  );
}

function SkeletonBlock({ width, height, borderRadius, style }: SkeletonBlockProps) {
  const shimmer = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(shimmer, {
          toValue: 1,
          duration: 900,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: false,
        }),
        Animated.timing(shimmer, {
          toValue: 0,
          duration: 900,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: false,
        }),
      ]),
    );
    animation.start();
    return () => {
      animation.stop();
    };
  }, [shimmer]);

  const backgroundColor = shimmer.interpolate({
    inputRange: [0, 1],
    outputRange: ["rgba(255,255,255,0.06)", "rgba(255,255,255,0.18)"],
  });

  return <Animated.View style={[{ width, height, borderRadius, backgroundColor }, style]} />;
}

function useUserProfile(userId: string | null) {
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const fetchProfile = useCallback(async () => {
    if (!userId) {
      if (mountedRef.current) {
        setProfile(null);
        setLoading(false);
      }
      return;
    }
    console.log("[Home] Fetching profile for", userId);
    if (mountedRef.current) {
      setLoading(true);
      setError(null);
    }
    try {
      const { data, error: queryError } = await supabase
        .from("profiles")
        .select("id, full_name, experience_level, schedule")
        .eq("id", userId)
        .limit(1)
        .maybeSingle();
      if (queryError) {
        console.log("[Home] Profile query error", queryError);
        throw new Error("Unable to load profile");
      }
      if (mountedRef.current) {
        setProfile(data ?? null);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "Profile load failed";
      if (mountedRef.current) {
        setError(message);
        setProfile(null);
      }
    } finally {
      if (mountedRef.current) {
        setLoading(false);
      }
    }
  }, [userId]);

  useEffect(() => {
    fetchProfile();
  }, [fetchProfile]);

  const refresh = useCallback(async () => {
    await fetchProfile();
  }, [fetchProfile]);

  return { profile, loading, error, refresh };
}

function useCurrentPlan(userId: string | null) {
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const [plan, setPlan] = useState<PlanData | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const fetchPlan = useCallback(async () => {
    if (!userId) {
      if (mountedRef.current) {
        setPlan(null);
        setLoading(false);
      }
      return;
    }
    console.log("[Home] Fetching plan for", userId);
    if (mountedRef.current) {
      setLoading(true);
      setError(null);
    }
    try {
      const runPlanQuery = async (fields: string) =>
        supabase
          .from("plans")
          .select(fields)
          .eq("user_id", userId)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();
      let planData: PlanData | null = null;
      let planError: any = null;
      let queryResult = await runPlanQuery("id, name, status, created_at");
      planData = (queryResult.data as PlanData | null) ?? null;
      planError = queryResult.error;
      if (planError && planError.code === "42703") {
        console.log("[Home] Plan query missing columns, retrying with fallback fields");
        queryResult = await runPlanQuery("id, status, created_at");
        planData = (queryResult.data as PlanData | null) ?? null;
        planError = queryResult.error;
      }
      if (planError && planError.code === "42703") {
        queryResult = await runPlanQuery("id, created_at");
        planData = (queryResult.data as PlanData | null) ?? null;
        planError = queryResult.error;
      }
      if (planError) {
        console.log("[Home] Plan query error", planError);
        throw new Error("Unable to load plan");
      }
      if (mountedRef.current) {
        setPlan(planData);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "Plan load failed";
      if (mountedRef.current) {
        setError(message);
        setPlan(null);
      }
    } finally {
      if (mountedRef.current) {
        setLoading(false);
      }
    }
  }, [userId]);

  useEffect(() => {
    fetchPlan();
  }, [fetchPlan]);

  const refresh = useCallback(async () => {
    await fetchPlan();
  }, [fetchPlan]);

  return { plan, loading, error, refresh };
}

function useTodayWorkout(userId: string | null) {
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const [todayWorkout, setTodayWorkout] = useState<HomeWorkout | null>(null);
  const [isRestDay, setIsRestDay] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const composeTodayWorkout = useCallback(async () => {
    if (!userId) {
      throw new Error("Sign in required");
    }
    console.log("[Home] compose_today invoked");
    const { data: composed, error: composeError } = await supabase.functions.invoke<ComposeTodayResponse>(
      "compose_today",
      { body: {} },
    );
    if (composeError) {
      console.log("[Home] compose_today error", composeError);
      throw new Error("Unable to compose today's plan");
    }
    if (mountedRef.current) {
      if (composed?.ok && composed.workout) {
        const mergedWorkout =
          composed.workout_id && typeof composed.workout_id === "string"
            ? { ...composed.workout, workout_id: composed.workout_id }
            : composed.workout;
        setTodayWorkout(mapEdgeWorkout(mergedWorkout));
        setIsRestDay(false);
        return composed;
      }
      if (composed?.code === "NO_WORKOUT_TODAY") {
        setTodayWorkout(null);
        setIsRestDay(true);
        return composed;
      }
      setTodayWorkout(null);
      setIsRestDay(true);
    }
    throw new Error("Coach could not compose today's workout");
  }, [userId]);

  const fetchTodayWorkout = useCallback(async () => {
    if (!userId) {
      if (mountedRef.current) {
        setTodayWorkout(null);
        setIsRestDay(true);
        setLoading(false);
      }
      return;
    }
    console.log("[Home] Fetching today workout for", userId);
    if (mountedRef.current) {
      setLoading(true);
      setError(null);
    }
    try {
      await composeTodayWorkout();
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to load workout";
      if (mountedRef.current) {
        setError(message);
        setTodayWorkout(null);
        setIsRestDay(true);
      }
    } finally {
      if (mountedRef.current) {
        setLoading(false);
      }
    }
  }, [composeTodayWorkout, userId]);

  useEffect(() => {
    fetchTodayWorkout();
  }, [fetchTodayWorkout]);

  const refresh = useCallback(async () => {
    await fetchTodayWorkout();
  }, [fetchTodayWorkout]);

  return { todayWorkout, isRestDay, loading, error, refresh, composeTodayWorkout };
}

function useUserStreak(userId: string | null) {
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const [streak, setStreak] = useState<number>(0);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const fetchStreak = useCallback(async () => {
    if (!userId) {
      if (mountedRef.current) {
        setStreak(0);
        setLoading(false);
      }
      return;
    }
    console.log("[Home] Fetching streak for", userId);
    if (mountedRef.current) {
      setLoading(true);
      setError(null);
    }
    try {
      const baseQuery = () =>
        supabase
          .from("workouts")
          .select("workout_date, completed")
          .eq("user_id", userId)
          .lte("workout_date", getTodayISO())
          .order("workout_date", { ascending: false })
          .limit(30);
      let { data, error: queryError } = await baseQuery();
      if (queryError && queryError.code === "42703") {
        console.log("[Home] Streak query missing 'completed', retrying without it");
        const fallback = await supabase
          .from("workouts")
          .select("workout_date")
          .eq("user_id", userId)
          .lte("workout_date", getTodayISO())
          .order("workout_date", { ascending: false })
          .limit(30);
        data = fallback.data?.map((row: any) => ({ ...row, completed: true })) ?? [];
        queryError = fallback.error;
      }
      if (queryError) {
        console.log("[Home] Streak query error", queryError);
        throw new Error("Unable to load streak");
      }
      if (mountedRef.current) {
        const computed = computeStreak(data ?? []);
        setStreak(computed);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to compute streak";
      if (mountedRef.current) {
        setError(message);
        setStreak(0);
      }
    } finally {
      if (mountedRef.current) {
        setLoading(false);
      }
    }
  }, [userId]);

  useEffect(() => {
    fetchStreak();
  }, [fetchStreak]);

  const refresh = useCallback(async () => {
    await fetchStreak();
  }, [fetchStreak]);

  return { streak, loading, error, refresh };
}

function useUserGoals(userId: string | null) {
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const [goals, setGoals] = useState<GoalProgress[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const fetchGoals = useCallback(async () => {
    if (!userId) {
      if (mountedRef.current) {
        setGoals([]);
        setLoading(false);
      }
      return;
    }
    console.log("[Home] Fetching goals for", userId);
    if (mountedRef.current) {
      setLoading(true);
      setError(null);
    }
    try {
      const exerciseIds = GOAL_EXERCISES.map((item) => item.id);
      const fetchTmRows = async (withFilter: boolean) => {
        let query = supabase
          .from("tm_history")
          .select("exercise_id, training_max, created_at")
          .eq("user_id", userId)
          .order("created_at", { ascending: false });
        if (withFilter && exerciseIds.length > 0) {
          query = query.in("exercise_id", exerciseIds);
        }
        return query;
      };
      let { data: tmRows, error: tmError } = await fetchTmRows(true);
      if (tmError && tmError.code === "22P02") {
        console.log("[Home] tm_history query rejected slug ids, retrying without filter");
        const fallback = await fetchTmRows(false);
        tmRows = fallback.data;
        tmError = fallback.error;
      }
      if (tmError) {
        console.log("[Home] tm_history query error", tmError);
        throw new Error("Unable to load training maxes");
      }
      const fetchGoalRows = async (withFilter: boolean) => {
        let query = supabase
          .from("goals")
          .select("exercise_id, target_tm, unit")
          .eq("user_id", userId);
        if (withFilter && exerciseIds.length > 0) {
          query = query.in("exercise_id", exerciseIds);
        }
        return query;
      };
      let { data: goalRows, error: goalError } = await fetchGoalRows(true);
      if (goalError && goalError.code === "PGRST205") {
        console.log("[Home] goals table missing, skipping goal load");
        goalRows = [];
        goalError = null;
      }
      if (goalError && goalError.code === "22P02") {
        console.log("[Home] goals query rejected slug ids, retrying without filter");
        const fallbackGoals = await fetchGoalRows(false);
        goalRows = fallbackGoals.data;
        goalError = fallbackGoals.error;
      }
      if (goalError) {
        console.log("[Home] goals query error", goalError);
        throw new Error("Unable to load goals");
      }
      if (mountedRef.current) {
        const latestTm = reduceLatestTm(tmRows ?? []);
        const mappedGoals = mapGoals(latestTm, goalRows ?? []);
        setGoals(mappedGoals);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to load goals";
      if (mountedRef.current) {
        setError(message);
        setGoals([]);
      }
    } finally {
      if (mountedRef.current) {
        setLoading(false);
      }
    }
  }, [userId]);

  useEffect(() => {
    fetchGoals();
  }, [fetchGoals]);

  const refresh = useCallback(async () => {
    await fetchGoals();
  }, [fetchGoals]);

  return { goals, loading, error, refresh };
}

function mapEdgeWorkout(edge: any): HomeWorkout {
  const fallbackDate = typeof edge?.workout_date === "string" ? edge.workout_date : getTodayISO();
  const workoutId =
    typeof edge?.workout_id === "string" && edge.workout_id.length > 0
      ? edge.workout_id
      : typeof edge?.id === "string" && edge.id.length > 0
        ? edge.id
        : `compose-${fallbackDate}`;
  const sets: HomeWorkoutSet[] = Array.isArray(edge?.sets)
    ? edge.sets.map((set: any, index: number) => {
        const dbSetId =
          typeof set?.id === "string" && set.id.length > 0
            ? set.id
            : typeof set?.set_id === "string" && set.set_id.length > 0
              ? set.set_id
              : `${workoutId}-set-${index}`;
        const exerciseName =
          typeof set?.exercise_name === "string"
            ? set.exercise_name
            : typeof set?.name === "string"
              ? set.name
              : "Exercise";
        const repsValue =
          typeof set?.reps === "number"
            ? set.reps
            : typeof set?.target_reps === "number"
              ? set.target_reps
              : null;
        const suggestedLoad =
          typeof set?.target_load === "number"
            ? set.target_load
            : typeof set?.load === "number"
              ? set.load
              : null;
        return {
          id: dbSetId,
          set_id: typeof set?.set_id === "string" ? set.set_id : dbSetId,
          set_no:
            typeof set?.set_no === "number"
              ? set.set_no
              : typeof set?.set === "number"
                ? set.set
                : index + 1,
          exercise_id: typeof set?.exercise_id === "string" ? set.exercise_id : null,
          exercise_name: exerciseName,
          reps: repsValue,
          intensity: typeof set?.intensity === "number" ? set.intensity : null,
          target_load: suggestedLoad,
          load: typeof set?.load === "number" ? set.load : null,
          amrap: typeof set?.amrap === "boolean" ? set.amrap : Boolean(set?.amrap),
        };
      })
    : [];
  return {
    id: workoutId,
    type: edge?.type ?? edge?.label ?? "Workout",
    workout_date: fallbackDate,
    notes: typeof edge?.notes === "string" ? edge.notes : null,
    sets,
  };
}

function groupWorkoutSets(sets: HomeWorkoutSet[]): ExerciseGroup[] {
  const groups = new Map<string, ExerciseGroup>();
  sets.forEach((set) => {
    const key = set.exercise_id ?? `exercise-${set.set_id}`;
    const current = groups.get(key);
    if (!current) {
      groups.set(key, {
        exercise_id: key,
        exercise_name: set.exercise_name,
        num_sets: 1,
        target_reps: typeof set.reps === "number" ? set.reps : 0,
        target_load: typeof set.target_load === "number" ? set.target_load : null,
        sets: [set],
      });
      return;
    }
    current.num_sets += 1;
    current.sets.push(set);
    if (current.target_reps === 0 && typeof set.reps === "number") {
      current.target_reps = set.reps;
    }
    if (current.target_load == null && typeof set.target_load === "number") {
      current.target_load = set.target_load;
    }
  });
  return Array.from(groups.values());
}

function createDefaultExerciseStateFromGroup(group: ExerciseGroup): ExerciseState {
  return {
    exercise_id: group.exercise_id,
    exercise_name: group.exercise_name,
    num_sets: group.num_sets,
    target_reps: group.target_reps,
    target_load: group.target_load,
    result_type: "unlogged",
    reps_missed_total: 0,
    weight_delta: 0,
  };
}

function buildFinishWorkoutPayload(
  workout: HomeWorkout,
  groups: ExerciseGroup[],
  states: Record<string, ExerciseState>,
) {
  const set_results = groups.flatMap((group) => {
    const state = states[group.exercise_id] ?? createDefaultExerciseStateFromGroup(group);
    return group.sets.map((set) => buildSetResultPayload(set, state));
  });
  return {
    workout_id: workout.id,
    workout_notes: workout.notes ?? null,
    set_results,
  };
}

function buildSetResultPayload(set: HomeWorkoutSet, state: ExerciseState): SetResultRecord {
  const setId = set.id ?? set.set_id;
  const reps = typeof set.reps === "number" ? set.reps : 0;
  const baseLoad = state.target_load;
  switch (state.result_type) {
    case "completed":
      return {
        set_id: setId,
        achieved_reps: reps,
        achieved_load: baseLoad,
        rpe: null,
        completed: true,
        notes: null,
      };
    case "missed": {
      const totalMissed = state.reps_missed_total ?? 0;
      const divisor = state.num_sets > 0 ? state.num_sets : 1;
      const perSetMiss = Math.floor(totalMissed / divisor);
      const performedReps = Math.max(reps - perSetMiss, 0);
      return {
        set_id: setId,
        achieved_reps: performedReps,
        achieved_load: baseLoad,
        rpe: null,
        completed: false,
        notes: null,
      };
    }
    case "adjusted_weight": {
      const delta = state.weight_delta ?? 0;
      const performedLoad = baseLoad == null ? null : baseLoad + delta;
      return {
        set_id: setId,
        achieved_reps: reps,
        achieved_load: performedLoad,
        rpe: null,
        completed: true,
        notes: null,
      };
    }
    case "skipped":
      return {
        set_id: setId,
        achieved_reps: 0,
        achieved_load: baseLoad,
        rpe: null,
        completed: false,
        notes: null,
      };
    case "unlogged":
    default:
      return {
        set_id: setId,
        achieved_reps: 0,
        achieved_load: baseLoad,
        rpe: null,
        completed: false,
        notes: null,
      };
  }
}

function getTodayISO() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function computeStreak(rows: any[]): number {
  if (!rows || rows.length === 0) {
    return 0;
  }
  const completedDates = new Set(
    rows
      .filter((row) => row.completed)
      .map((row) => row.workout_date)
      .filter((date) => typeof date === "string"),
  );
  const today = new Date(getTodayISO());
  let streak = 0;
  for (let offset = 0; offset < 60; offset += 1) {
    const checkDate = new Date(today);
    checkDate.setDate(today.getDate() - offset);
    const iso = getISOFromDate(checkDate);
    if (completedDates.has(iso)) {
      streak += 1;
    } else {
      if (offset === 0) {
        continue;
      }
      break;
    }
  }
  return streak;
}

function getISOFromDate(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function reduceLatestTm(rows: SupabaseTmRow[]) {
  const latest: Record<string, number> = {};
  rows.forEach((row) => {
    if (typeof row.training_max !== "number") {
      return;
    }
    if (latest[row.exercise_id] !== undefined) {
      return;
    }
    latest[row.exercise_id] = row.training_max;
  });
  return latest;
}

function mapGoals(latestTm: Record<string, number>, goalRows: SupabaseGoalRow[]): GoalProgress[] {
  return GOAL_EXERCISES.reduce<GoalProgress[]>((acc, exercise) => {
    const current = latestTm[exercise.id];
    const goalRow = goalRows.find((row) => row.exercise_id === exercise.id);
    const target = goalRow?.target_tm ?? null;
    if (typeof current !== "number" || typeof target !== "number" || target <= 0) {
      return acc;
    }
    const progress = Math.max(0, (current / target) * 100);
    acc.push({
      id: exercise.id,
      name: exercise.name,
      progress,
      current: Number(current.toFixed(1)),
      target: Number(target.toFixed(1)),
      unit: goalRow?.unit ?? exercise.unit,
    });
    return acc;
  }, []);
}

const styles = StyleSheet.create({
  screenContainer: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 20,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingBottom: 24,
  },
  headerCopy: {
    flex: 1,
    paddingRight: 16,
  },
  greeting: {
    fontSize: 32,
    fontWeight: "700" as const,
    color: Colors.text,
    marginBottom: 6,
  },
  subtitle: {
    fontSize: 16,
    color: Colors.textSecondary,
  },
  profileButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: Colors.cardBackground,
    borderWidth: 1,
    borderColor: Colors.border,
    alignItems: "center",
    justifyContent: "center",
  },
  profileButtonPressed: {
    backgroundColor: Colors.primary,
  },
  headerSkeleton: {
    marginBottom: 12,
  },
  streakCard: {
    borderRadius: 28,
    overflow: "hidden",
    marginBottom: 24,
  },
  streakGradient: {
    padding: 28,
    alignItems: "center",
    justifyContent: "center",
  },
  streakIconWrap: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: "rgba(255,255,255,0.12)",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16,
  },
  streakNumber: {
    fontSize: 56,
    fontWeight: "800" as const,
    color: Colors.text,
    marginBottom: 4,
  },
  streakLabel: {
    fontSize: 18,
    fontWeight: "600" as const,
    color: Colors.text,
    marginBottom: 4,
  },
  streakSubtext: {
    fontSize: 14,
    color: "rgba(255,255,255,0.78)",
  },
  streakSkeleton: {
    marginBottom: 12,
  },
  todayCard: {
    backgroundColor: Colors.cardBackground,
    borderRadius: 28,
    padding: 24,
    marginBottom: 24,
  },
  todaySkeleton: {
    marginBottom: 16,
  },
  todayHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
  },
  todayHeaderLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  todayTitle: {
    fontSize: 18,
    fontWeight: "700" as const,
    color: Colors.text,
  },
  workoutTypeBadge: {
    backgroundColor: "rgba(255,255,255,0.08)",
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 16,
  },
  workoutTypeBadgeText: {
    fontSize: 12,
    fontWeight: "600" as const,
    color: Colors.text,
    letterSpacing: 0.6,
  },
  workoutHeadline: {
    fontSize: 24,
    fontWeight: "700" as const,
    color: Colors.text,
    marginBottom: 6,
  },
  workoutMeta: {
    fontSize: 15,
    color: Colors.textSecondary,
    marginBottom: 18,
  },
  workoutNotes: {
    fontSize: 15,
    color: Colors.textSecondary,
    marginBottom: 18,
    lineHeight: 22,
  },
  todayBadgeRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 14,
  },
  todayBadgeIcon: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: "rgba(255,255,255,0.08)",
  },
  todayBadgeText: {
    fontSize: 13,
    color: Colors.text,
    fontWeight: "600" as const,
  },
  greetingInline: {
    fontSize: 15,
    color: Colors.textSecondary,
    marginTop: 6,
  },
  exerciseList: {
    marginTop: 12,
    gap: 18,
  },
  exerciseCard: {
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
    borderRadius: 20,
    padding: 18,
    backgroundColor: Colors.cardBackground,
    gap: 10,
  },
  exerciseTitle: {
    fontSize: 17,
    fontWeight: "700" as const,
    color: Colors.text,
  },
  exerciseSubtitle: {
    fontSize: 14,
    color: Colors.textSecondary,
  },
  exerciseButtonRow: {
    flexDirection: "column",
    gap: 8,
    marginTop: 8,
  },
  exerciseActionButton: {
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.12)",
    borderRadius: 16,
    paddingVertical: 10,
    paddingHorizontal: 14,
  },
  exerciseActionButtonActive: {
    borderColor: Colors.primary,
    backgroundColor: "rgba(255,255,255,0.08)",
  },
  exerciseActionLabel: {
    fontSize: 14,
    color: Colors.textSecondary,
    fontWeight: "600" as const,
  },
  exerciseActionLabelActive: {
    color: Colors.text,
  },
  emptyCard: {
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
    padding: 20,
    backgroundColor: Colors.cardBackground,
    gap: 6,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: "600" as const,
    color: Colors.text,
  },
  emptySubtitle: {
    fontSize: 13,
    color: Colors.textSecondary,
  },
  finishWorkoutButton: {
    backgroundColor: Colors.primary,
    paddingVertical: 16,
    borderRadius: 20,
    alignItems: "center",
  },
  finishWorkoutButtonDisabled: {
    opacity: 0.6,
  },
  finishWorkoutButtonText: {
    fontSize: 16,
    color: Colors.background,
    fontWeight: "700" as const,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.65)",
    justifyContent: "flex-end",
  },
  modalContent: {
    backgroundColor: Colors.cardBackground,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    padding: 24,
    gap: 12,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: "700" as const,
    color: Colors.text,
    marginBottom: 4,
  },
  modalOption: {
    paddingVertical: 12,
  },
  modalOptionText: {
    fontSize: 16,
    color: Colors.textSecondary,
  },
  modalCustom: {
    gap: 8,
    paddingVertical: 10,
  },
  modalInput: {
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.15)",
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: Colors.text,
  },
  modalConfirm: {
    backgroundColor: Colors.primary,
    borderRadius: 14,
    paddingVertical: 10,
    alignItems: "center",
  },
  modalConfirmText: {
    color: Colors.background,
    fontWeight: "700" as const,
  },
  modalCancel: {
    marginTop: 4,
    alignItems: "center",
    paddingVertical: 8,
  },
  modalCancelText: {
    color: Colors.textSecondary,
    fontSize: 15,
  },
  restBadge: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: Colors.background,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 18,
  },
  restTitle: {
    fontSize: 24,
    fontWeight: "700" as const,
    color: Colors.text,
    marginBottom: 8,
  },
  restText: {
    fontSize: 15,
    color: Colors.textSecondary,
    lineHeight: 22,
  },
  generatePlanCard: {
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
  },
  generatePlanHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginBottom: 12,
  },
  generatePlanTitle: {
    fontSize: 20,
    fontWeight: "700" as const,
    color: Colors.text,
  },
  generatePlanSubtitle: {
    fontSize: 15,
    color: Colors.textSecondary,
    marginBottom: 20,
    lineHeight: 22,
  },
  generatePlanButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    backgroundColor: Colors.primary,
    paddingVertical: 16,
    borderRadius: 18,
    marginBottom: 16,
  },
  generatePlanButtonText: {
    fontSize: 16,
    fontWeight: "700" as const,
    color: Colors.text,
  },
  generatePlanFooter: {
    fontSize: 13,
    color: Colors.textSecondary,
  },
  goalsSection: {
    marginBottom: 24,
  },
  goalsHeader: {
    marginBottom: 16,
  },
  goalsTitle: {
    fontSize: 22,
    fontWeight: "700" as const,
    color: Colors.text,
    marginBottom: 4,
  },
  goalsSubtitle: {
    fontSize: 14,
    color: Colors.textSecondary,
  },
  goalSkeleton: {
    marginBottom: 16,
  },
  goalsEmpty: {
    backgroundColor: Colors.cardBackground,
    borderRadius: 24,
    padding: 24,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  goalsEmptyTitle: {
    fontSize: 18,
    fontWeight: "700" as const,
    color: Colors.text,
    marginBottom: 8,
  },
  goalsEmptySubtitle: {
    fontSize: 14,
    color: Colors.textSecondary,
    lineHeight: 22,
  },
  goalCard: {
    backgroundColor: Colors.cardBackground,
    borderRadius: 22,
    padding: 20,
    borderWidth: 1,
    borderColor: Colors.border,
    marginBottom: 16,
  },
  goalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  goalExercise: {
    fontSize: 18,
    fontWeight: "700" as const,
    color: Colors.text,
  },
  goalProgressLabel: {
    fontSize: 16,
    fontWeight: "700" as const,
    color: Colors.primary,
  },
  goalBarTrack: {
    height: 10,
    borderRadius: 12,
    backgroundColor: Colors.background,
    overflow: "hidden",
    marginBottom: 12,
  },
  goalBarFill: {
    height: "100%",
    backgroundColor: Colors.primary,
  },
  goalStatsRow: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  goalStat: {
    fontSize: 13,
    color: Colors.textSecondary,
  },
  errorContainer: {
    flex: 1,
    backgroundColor: Colors.background,
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
  },
  errorTitle: {
    fontSize: 20,
    fontWeight: "700" as const,
    color: Colors.text,
    marginBottom: 8,
    textAlign: "center",
  },
  errorSubtitle: {
    fontSize: 14,
    color: Colors.textSecondary,
    textAlign: "center",
    lineHeight: 20,
  },
  loadingContainer: {
    flex: 1,
    backgroundColor: Colors.background,
    justifyContent: "center",
    alignItems: "center",
  },
});
