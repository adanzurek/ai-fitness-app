import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Animated,
  Easing,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  ViewStyle,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useNavigation, useFocusEffect } from "@react-navigation/native";
import { useRouter } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import { Calendar, Flame, Sparkles, Dumbbell, Wand2, ArrowRight } from "lucide-react-native";
import type { NavigationProp } from "@react-navigation/native";
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

type HomeWorkoutExercise = {
  id: string;
  name: string;
  sets?: number | null;
  reps?: number | string | null;
};

type HomeWorkout = {
  id: string;
  label: string;
  workout_date: string;
  exercises: HomeWorkoutExercise[];
  completed?: boolean | null;
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
  onPressStartWorkout: () => void;
  onPressGeneratePlan: () => void;
  generatingPlan: boolean;
  scheduleDays: number;
  error: string | null;
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
  width: number | string;
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
  const navigation = useNavigation<NavigationProp<Record<string, object | undefined>>>();
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
  } = useTodayWorkout(userId);

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
    console.log("[Home] Generating plan for", userId);
    setGeneratingPlan(true);
    try {
      const { data: planData, error: planError } = await supabase.functions.invoke("generate_plan_ai", {
        body: { user_id: userId },
      });
      if (planError) {
        console.log("[Home] generate_plan_ai error", planError);
        throw new Error("Unable to generate plan.");
      }
      if (!planData?.ok) {
        throw new Error("Coach could not generate a plan. Try again later.");
      }
      const todayIso = getTodayISO();
      const { data: weekData, error: weekError } = await supabase.functions.invoke("generate_week", {
        body: {
          user_id: userId,
          days: scheduleDays,
          start_date: todayIso,
        },
      });
      if (weekError) {
        console.log("[Home] generate_week error", weekError);
        throw new Error("Unable to schedule workouts right now.");
      }
      if (!weekData?.ok) {
        throw new Error("Plan created but workouts were not scheduled. Try again.");
      }
      await Promise.allSettled([
        refreshPlan(),
        refreshTodayWorkout(),
        refreshGoals(),
        refreshStreak(),
      ]);
      Alert.alert("Plan ready", "Your new week is on the calendar.");
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to generate plan.";
      Alert.alert("Something went wrong", message);
    } finally {
      setGeneratingPlan(false);
    }
  }, [refreshGoals, refreshPlan, refreshStreak, refreshTodayWorkout, scheduleDays, userId]);

  const handleStartWorkout = useCallback(() => {
    if (!todayWorkout) {
      return;
    }
    console.log("[Home] Navigating to WorkoutDetail", todayWorkout.id);
    navigation.navigate("WorkoutDetail", { workoutId: todayWorkout.id });
  }, [navigation, todayWorkout]);

  const handleProfilePress = useCallback(() => {
    console.log("[Home] Navigating to profile");
    router.push("/profile");
  }, [router]);

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
          onPressStartWorkout={handleStartWorkout}
          onPressGeneratePlan={handleGeneratePlan}
          generatingPlan={generatingPlan}
          scheduleDays={scheduleDays}
          error={todayError}
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
  onPressStartWorkout,
  onPressGeneratePlan,
  generatingPlan,
  scheduleDays,
  error,
}: TodaySectionProps) {
  if (loading || planLoading) {
    return (
      <View style={styles.todayCard} testID="today-card-loading">
        <SkeletonBlock width={120} height={20} borderRadius={10} style={styles.todaySkeleton} />
        <SkeletonBlock width="100%" height={32} borderRadius={12} style={styles.todaySkeleton} />
        <SkeletonBlock width="60%" height={16} borderRadius={8} />
      </View>
    );
  }

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

  if (error) {
    return (
      <View style={styles.todayCard}>
        <Text style={styles.errorTitle}>Unable to load workout</Text>
        <Text style={styles.errorSubtitle}>{error}</Text>
      </View>
    );
  }

  if (isRestDay || !workout) {
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

  const exerciseCount = workout.exercises.length;

  return (
    <View style={styles.todayCard} testID="today-workout-card">
      <View style={styles.todayHeader}>
        <View style={styles.todayHeaderLeft}>
          <Calendar size={20} color={Colors.primary} />
          <Text style={styles.todayTitle}>Today&apos;s Workout</Text>
        </View>
        <View style={styles.workoutTypeBadge}>
          <Text style={styles.workoutTypeBadgeText}>{workout.label}</Text>
        </View>
      </View>
      <Text style={styles.workoutHeadline}>Let&apos;s make it count</Text>
      <Text style={styles.workoutMeta}>{exerciseCount} exercises dialed in for you.</Text>
      <View style={styles.workoutChipRow}>
        {workout.exercises.slice(0, 3).map((exercise) => (
          <View key={exercise.id} style={styles.workoutChip}>
            <Dumbbell color={Colors.text} size={14} />
            <Text style={styles.workoutChipText}>{exercise.name}</Text>
          </View>
        ))}
      </View>
      <TouchableOpacity
        activeOpacity={0.85}
        onPress={onPressStartWorkout}
        style={styles.startWorkoutButton}
        testID="start-workout-button"
      >
        <Text style={styles.startWorkoutButtonText}>Start Workout</Text>
        <ArrowRight color={Colors.background} size={18} />
      </TouchableOpacity>
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
      const { data, error: queryError } = await supabase
        .from("plans")
        .select("id, name, status, created_at")
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (queryError) {
        console.log("[Home] Plan query error", queryError);
        throw new Error("Unable to load plan");
      }
      if (mountedRef.current) {
        setPlan(data ?? null);
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
      const todayIso = getTodayISO();
      const { data: workoutRow, error: workoutError } = await supabase
        .from("workouts")
        .select("id, label, workout_date, completed, exercises")
        .eq("user_id", userId)
        .eq("workout_date", todayIso)
        .limit(1)
        .maybeSingle();
      if (workoutError) {
        console.log("[Home] Workouts query error", workoutError);
        throw new Error("Unable to load today\'s workout");
      }
      if (workoutRow) {
        const mapped = mapWorkoutRow(workoutRow);
        if (mountedRef.current) {
          setTodayWorkout(mapped);
          setIsRestDay(Boolean(workoutRow.completed));
        }
        return;
      }
      const { data: composed, error: composeError } = await supabase.functions.invoke("compose_today", {
        body: { user_id: userId },
      });
      if (composeError) {
        console.log("[Home] compose_today error", composeError);
        throw new Error("Unable to compose today\'s plan");
      }
      if (mountedRef.current) {
        if (composed?.ok && composed.workout) {
          setTodayWorkout(mapEdgeWorkout(composed.workout));
          setIsRestDay(false);
        } else {
          setTodayWorkout(null);
          setIsRestDay(true);
        }
      }
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
  }, [userId]);

  useEffect(() => {
    fetchTodayWorkout();
  }, [fetchTodayWorkout]);

  const refresh = useCallback(async () => {
    await fetchTodayWorkout();
  }, [fetchTodayWorkout]);

  return { todayWorkout, isRestDay, loading, error, refresh };
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
      const { data, error: queryError } = await supabase
        .from("workouts")
        .select("workout_date, completed")
        .eq("user_id", userId)
        .lte("workout_date", getTodayISO())
        .order("workout_date", { ascending: false })
        .limit(30);
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
      const { data: tmRows, error: tmError } = await supabase
        .from("tm_history")
        .select("exercise_id, training_max, created_at")
        .eq("user_id", userId)
        .in("exercise_id", exerciseIds)
        .order("created_at", { ascending: false });
      if (tmError) {
        console.log("[Home] tm_history query error", tmError);
        throw new Error("Unable to load training maxes");
      }
      const { data: goalRows, error: goalError } = await supabase
        .from("goals")
        .select("exercise_id, target_tm, unit")
        .eq("user_id", userId)
        .in("exercise_id", exerciseIds);
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

function mapWorkoutRow(row: any): HomeWorkout {
  const exercises = Array.isArray(row.exercises)
    ? row.exercises.map((exercise: any, index: number) => ({
        id: typeof exercise?.id === "string" ? exercise.id : `${row.id}-ex-${index}`,
        name: typeof exercise?.name === "string" ? exercise.name : "Exercise",
        sets: typeof exercise?.sets === "number" ? exercise.sets : null,
        reps: exercise?.reps ?? null,
      }))
    : [];
  return {
    id: row.id,
    label: row.label ?? "Workout",
    workout_date: row.workout_date,
    exercises,
    completed: typeof row.completed === "boolean" ? row.completed : null,
  };
}

function mapEdgeWorkout(edge: any): HomeWorkout {
  const exercises = Array.isArray(edge.exercises)
    ? edge.exercises.map((exercise: any, index: number) => ({
        id: typeof exercise?.id === "string" ? exercise.id : `${edge.id}-edge-${index}`,
        name: typeof exercise?.name === "string" ? exercise.name : "Exercise",
        sets: typeof exercise?.sets === "number" ? exercise.sets : null,
        reps: exercise?.reps ?? null,
      }))
    : [];
  return {
    id: edge.id,
    label: edge.label ?? "Workout",
    workout_date: edge.workout_date,
    exercises,
    completed: null,
  };
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
  workoutChipRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
    marginBottom: 24,
  },
  workoutChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 8,
    backgroundColor: Colors.background,
    borderRadius: 18,
  },
  workoutChipText: {
    fontSize: 13,
    fontWeight: "600" as const,
    color: Colors.text,
  },
  startWorkoutButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: Colors.primary,
    paddingVertical: 16,
    paddingHorizontal: 20,
    borderRadius: 20,
  },
  startWorkoutButtonText: {
    fontSize: 16,
    fontWeight: "700" as const,
    color: Colors.background,
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
