import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useEffect, useMemo, useState } from "react";
import Colors from "@/constants/colors";
import { useSupabaseUser } from "@/hooks/useSupabaseUser";
import { supabase, isSupabaseConfigured } from "@/lib/supabase";
import { useMutation } from "@tanstack/react-query";
import { CheckCircle2, Circle, ArrowRight } from "lucide-react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

const CARD_HORIZONTAL_PADDING = 20;

interface ComposeTodayExercise {
  id: string;
  name: string;
  sets?: number | null;
  reps?: number | null;
  rir?: number | null;
  weight?: number | null;
}

interface ComposeTodayWorkout {
  id: string;
  label: string;
  workout_date: string;
  exercises?: ComposeTodayExercise[] | null;
}

interface ComposeTodayResponse {
  ok: boolean;
  workout: ComposeTodayWorkout | null;
  reason?: "rest" | "no_plan" | string;
}

type LogCompletionInput = {
  exerciseId: string;
  completed: boolean;
  previous: boolean;
};

type ParsedParams = {
  dateISO: string;
  payload: ComposeTodayResponse | null;
};

function formatFriendlyDate(dateISO: string) {
  const date = new Date(dateISO);
  return date.toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
    weekday: "long",
  });
}

function decodeParams(rawDate?: string | string[], rawPayload?: string | string[]): ParsedParams {
  const dateISO = typeof rawDate === "string" ? rawDate : Array.isArray(rawDate) ? rawDate[0] : "";
  if (!rawPayload) {
    return { dateISO, payload: null };
  }
  const encoded = typeof rawPayload === "string" ? rawPayload : Array.isArray(rawPayload) ? rawPayload[0] : "";
  if (!encoded) {
    return { dateISO, payload: null };
  }
  try {
    const decoded = decodeURIComponent(encoded);
    const parsed = JSON.parse(decoded) as ComposeTodayResponse;
    return { dateISO, payload: parsed };
  } catch (error) {
    console.error("[DayView] Failed to parse payload", error);
    return { dateISO, payload: null };
  }
}

export default function DayViewScreen() {
  const params = useLocalSearchParams();
  const router = useRouter();
  const { user } = useSupabaseUser();
  const insets = useSafeAreaInsets();
  const { dateISO, payload } = useMemo(() => decodeParams(params.date, params.payload), [params.date, params.payload]);
  const workout = payload?.workout ?? null;
  const isRestDay = useMemo(() => {
    if (!payload) {
      return false;
    }
    if (payload.reason === "rest") {
      return true;
    }
    return payload.ok === true && !payload.workout;
  }, [payload]);
  const isNoPlan = useMemo(() => {
    if (!payload) {
      return false;
    }
    if (payload.reason === "no_plan") {
      return true;
    }
    return payload.ok === false && !payload.workout;
  }, [payload]);
  const isUnknown = !payload && !workout;

  const [completionStates, setCompletionStates] = useState<Record<string, boolean>>({});

  useEffect(() => {
    if (workout?.exercises && workout.exercises.length > 0) {
      const initialState = workout.exercises.reduce<Record<string, boolean>>((acc, exercise) => {
        acc[exercise.id] = false;
        return acc;
      }, {});
      setCompletionStates(initialState);
    } else {
      setCompletionStates({});
    }
  }, [workout?.id, workout?.exercises]);

  const logCompletionMutation = useMutation({
    mutationFn: async ({ exerciseId, completed }: LogCompletionInput) => {
      if (!isSupabaseConfigured) {
        throw new Error("Supabase not configured");
      }
      if (!user?.id) {
        throw new Error("User required");
      }
      if (!workout) {
        throw new Error("Workout not available");
      }
      console.log("[DayView] log_workout_completion invoked", { exerciseId, completed, dateISO });
      const { error } = await supabase.functions.invoke("log_workout_completion", {
        body: {
          user_id: user.id,
          workout_id: workout.id,
          exercise_id: exerciseId,
          completed,
          date: dateISO,
        },
      });
      if (error) {
        console.error("[DayView] log_workout_completion error", error);
        throw error;
      }
      return { exerciseId, completed };
    },
    onError: (error, variables) => {
      console.error("[DayView] Unable to update exercise", error);
      setCompletionStates((prev) => ({ ...prev, [variables.exerciseId]: variables.previous }));
      Alert.alert("Update failed", "We couldn\'t save this exercise. Please try again.");
    },
  });

  const handleToggleExercise = (exerciseId: string) => {
    setCompletionStates((prev) => {
      const previous = prev[exerciseId] ?? false;
      const next = { ...prev, [exerciseId]: !previous };
      logCompletionMutation.mutate({ exerciseId, completed: !previous, previous });
      return next;
    });
  };

  const goToCoach = () => {
    router.push("/(tabs)/coach");
  };

  const headerTitle = useMemo(() => {
    if (isNoPlan) {
      return "No Plan";
    }
    if (isRestDay) {
      return "Rest Day";
    }
    if (workout?.label) {
      return workout.label;
    }
    return "Day View";
  }, [isNoPlan, isRestDay, workout?.label]);

  return (
    <View style={styles.container} testID="day-view-screen">
      <Stack.Screen
        options={{
          title: headerTitle,
          headerStyle: { backgroundColor: Colors.background },
          headerTintColor: Colors.text,
        }}
      />
      <ScrollView
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 60 }]}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.heroCard}>
          <Text style={styles.heroLabel}>Selected Day</Text>
          <Text style={styles.heroDate}>{dateISO ? formatFriendlyDate(dateISO) : "Unknown date"}</Text>
          {workout?.label ? <Text style={styles.heroWorkout}>{workout.label}</Text> : null}
        </View>

        {isNoPlan ? (
          <View style={styles.noPlanCard}>
            <Text style={styles.noPlanTitle}>No training plan yet</Text>
            <Text style={styles.noPlanSubtitle}>
              Visit the Coach tab to build your custom program before logging workouts here.
            </Text>
            <TouchableOpacity style={styles.noPlanButton} onPress={goToCoach} testID="day-view-coach-button" activeOpacity={0.8}>
              <Text style={styles.noPlanButtonText}>Go to Coach</Text>
              <ArrowRight size={18} color={Colors.background} />
            </TouchableOpacity>
          </View>
        ) : null}

        {isRestDay ? (
          <View style={styles.restCard}>
            <Text style={styles.restEmoji}>🧘</Text>
            <Text style={styles.restTitle}>Rest Day! No workout scheduled.</Text>
            <Text style={styles.restDescription}>
              Keep the momentum with light movement, stretching, or a walk. Recovery keeps your streak alive.
            </Text>
          </View>
        ) : null}

        {isUnknown ? (
          <View style={styles.unknownCard}>
            <Text style={styles.unknownTitle}>We couldn&apos;t load this day.</Text>
            <Text style={styles.unknownSubtitle}>Try tapping the date again to refresh the workout details.</Text>
          </View>
        ) : null}

        {workout && workout.exercises && workout.exercises.length > 0 ? (
          <View style={styles.exercisesSection}>
            <Text style={styles.sectionTitle}>Workout Breakdown</Text>
            <View style={styles.exercisesCard}>
              {workout.exercises.map((exercise) => {
                const completed = completionStates[exercise.id] ?? false;
                return (
                  <TouchableOpacity
                    key={exercise.id}
                    style={[styles.exerciseRow, completed && styles.exerciseRowCompleted]}
                    onPress={() => handleToggleExercise(exercise.id)}
                    activeOpacity={0.85}
                    testID={`exercise-toggle-${exercise.id}`}
                    disabled={logCompletionMutation.isPending}
                  >
                    <View style={styles.exerciseLeft}>
                      <View style={styles.iconWrapper}>
                        {completed ? (
                          <CheckCircle2 size={24} color={Colors.primary} />
                        ) : (
                          <Circle size={24} color={"rgba(255,255,255,0.35)"} />
                        )}
                      </View>
                      <View style={styles.exerciseTextBlock}>
                        <Text style={styles.exerciseName}>{exercise.name}</Text>
                        <Text style={styles.exerciseMeta}>
                          {[
                            exercise.sets ? `${exercise.sets} sets` : null,
                            exercise.reps ? `${exercise.reps} reps` : null,
                            exercise.rir ? `RIR ${exercise.rir}` : null,
                            exercise.weight ? `${exercise.weight} lbs` : null,
                          ]
                            .filter(Boolean)
                            .join(" · ") || "Custom work"}
                        </Text>
                      </View>
                    </View>
                    {logCompletionMutation.isPending && logCompletionMutation.variables?.exerciseId === exercise.id ? (
                      <ActivityIndicator size="small" color={Colors.primary} />
                    ) : (
                      <Text style={[styles.exerciseStatus, completed && styles.exerciseStatusCompleted]}>
                        {completed ? "Completed" : "Tap to complete"}
                      </Text>
                    )}
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
        ) : null}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  content: {
    paddingBottom: 60,
    paddingHorizontal: CARD_HORIZONTAL_PADDING,
    paddingTop: 24,
    gap: 24,
  },
  heroCard: {
    backgroundColor: "#101010",
    borderRadius: 28,
    padding: 24,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.35,
    shadowRadius: 24,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.05)",
  },
  heroLabel: {
    fontSize: 13,
    color: "rgba(255,255,255,0.6)",
    fontWeight: "600" as const,
    marginBottom: 8,
  },
  heroDate: {
    fontSize: 26,
    fontWeight: "700" as const,
    color: Colors.text,
    marginBottom: 12,
  },
  heroWorkout: {
    fontSize: 16,
    color: Colors.textSecondary,
  },
  noPlanCard: {
    padding: 24,
    borderRadius: 28,
    backgroundColor: "#1d0f0f",
    borderWidth: 1,
    borderColor: "rgba(255, 46, 46, 0.35)",
    gap: 16,
  },
  noPlanTitle: {
    fontSize: 20,
    fontWeight: "700" as const,
    color: "#FF8080",
  },
  noPlanSubtitle: {
    fontSize: 14,
    color: "rgba(255,255,255,0.75)",
    lineHeight: 20,
  },
  noPlanButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    paddingVertical: 14,
    borderRadius: 16,
    backgroundColor: Colors.primary,
  },
  noPlanButtonText: {
    color: Colors.background,
    fontSize: 15,
    fontWeight: "700" as const,
  },
  unknownCard: {
    padding: 24,
    borderRadius: 28,
    backgroundColor: "#311b4b",
    borderWidth: 1,
    borderColor: "rgba(180, 108, 255, 0.4)",
    gap: 12,
  },
  unknownTitle: {
    fontSize: 18,
    fontWeight: "700" as const,
    color: "#E5D7FF",
  },
  unknownSubtitle: {
    fontSize: 14,
    color: "rgba(229,215,255,0.8)",
    lineHeight: 20,
  },
  restCard: {
    padding: 26,
    borderRadius: 28,
    backgroundColor: "#111527",
    borderWidth: 1,
    borderColor: "rgba(88, 129, 235, 0.35)",
    gap: 12,
    alignItems: "center",
  },
  restEmoji: {
    fontSize: 48,
  },
  restTitle: {
    fontSize: 20,
    fontWeight: "700" as const,
    color: Colors.text,
    textAlign: "center",
  },
  restDescription: {
    fontSize: 14,
    color: Colors.textSecondary,
    textAlign: "center",
    lineHeight: 20,
  },
  exercisesSection: {
    gap: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "700" as const,
    color: Colors.text,
  },
  exercisesCard: {
    borderRadius: 28,
    backgroundColor: "#0f0f0f",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.06)",
    paddingVertical: 6,
  },
  exerciseRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 16,
    paddingHorizontal: 18,
    gap: 12,
  },
  exerciseRowCompleted: {
    backgroundColor: "rgba(34,197,94,0.08)",
  },
  exerciseLeft: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 14,
    flex: 1,
  },
  iconWrapper: {
    width: 32,
    alignItems: "center",
  },
  exerciseTextBlock: {
    flex: 1,
  },
  exerciseName: {
    fontSize: 16,
    fontWeight: "700" as const,
    color: Colors.text,
    marginBottom: 4,
  },
  exerciseMeta: {
    fontSize: 13,
    color: "rgba(255,255,255,0.6)",
  },
  exerciseStatus: {
    fontSize: 12,
    color: "rgba(255,255,255,0.5)",
    fontWeight: "600" as const,
  },
  exerciseStatusCompleted: {
    color: "#22c55e",
  },
});
