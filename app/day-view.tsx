import { Stack, useLocalSearchParams } from "expo-router";
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
import { CheckCircle2, Circle } from "lucide-react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

const CARD_HORIZONTAL_PADDING = 20;

type WorkoutSet = {
  id: string;
  name: string;
  sets?: number | null;
  reps?: number | null;
  rir?: number | null;
  weight?: number | null;
};

type LogCompletionInput = {
  exerciseId: string;
  completed: boolean;
  previous: boolean;
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

function getParamValue(param?: string | string[]): string {
  if (typeof param === "string") {
    return param;
  }
  if (Array.isArray(param) && param.length > 0) {
    return param[0] ?? "";
  }
  return "";
}

function parseSets(rawSets: string): WorkoutSet[] {
  if (!rawSets) {
    return [];
  }
  try {
    const parsed = JSON.parse(rawSets) as unknown;
    if (Array.isArray(parsed)) {
      return parsed.filter((item): item is WorkoutSet => {
        if (!item || typeof item !== "object") {
          return false;
        }
        const candidate = item as Partial<WorkoutSet>;
        return typeof candidate.id === "string" && typeof candidate.name === "string";
      });
    }
  } catch (error) {
    console.error("[DayView] Failed to parse sets", error);
  }
  return [];
}

export default function DayViewScreen() {
  const params = useLocalSearchParams();
  const { user } = useSupabaseUser();
  const insets = useSafeAreaInsets();

  const dateISO = useMemo(() => getParamValue(params.date), [params.date]);
  const isRestParam = useMemo(() => getParamValue(params.isRest), [params.isRest]);
  const workoutId = useMemo(() => getParamValue(params.workoutId), [params.workoutId]);
  const workoutType = useMemo(() => getParamValue(params.type), [params.type]);
  const workoutNotes = useMemo(() => getParamValue(params.notes), [params.notes]);
  const rawSets = useMemo(() => getParamValue(params.sets), [params.sets]);
  const parsedSets = useMemo(() => parseSets(rawSets), [rawSets]);

  const isRestDay = isRestParam === "true";
  const hasWorkout = !isRestDay && workoutId.trim().length > 0;
  const hasExercises = parsedSets.length > 0;
  const headerTitle = isRestDay ? "Rest Day" : workoutType || "Day View";
  const friendlyDate = useMemo(() => (dateISO ? formatFriendlyDate(dateISO) : "Unknown date"), [dateISO]);

  const [completionStates, setCompletionStates] = useState<Record<string, boolean>>({});

  useEffect(() => {
    if (hasExercises) {
      const initialState = parsedSets.reduce<Record<string, boolean>>((acc, exercise) => {
        acc[exercise.id] = false;
        return acc;
      }, {});
      setCompletionStates(initialState);
      return;
    }
    setCompletionStates({});
  }, [hasExercises, parsedSets]);

  const logCompletionMutation = useMutation({
    mutationFn: async ({ exerciseId, completed }: LogCompletionInput) => {
      if (!isSupabaseConfigured) {
        throw new Error("Supabase not configured");
      }
      if (!user?.id) {
        throw new Error("User required");
      }
      if (!hasWorkout) {
        throw new Error("Workout not available");
      }
      console.log("[DayView] log_workout_completion invoked", {
        exerciseId,
        completed,
        date: dateISO,
        workoutId,
      });
      const { error } = await supabase.functions.invoke("log_workout_completion", {
        body: {
          user_id: user.id,
          workout_id: workoutId,
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
    if (!hasWorkout) {
      Alert.alert("Workout unavailable", "We couldn't find this workout. Try another date.");
      return;
    }
    setCompletionStates((prev) => {
      const previous = prev[exerciseId] ?? false;
      const next = { ...prev, [exerciseId]: !previous };
      logCompletionMutation.mutate({ exerciseId, completed: !previous, previous });
      return next;
    });
  };

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
          <Text style={styles.heroDate}>{friendlyDate}</Text>
          {!isRestDay && workoutType ? <Text style={styles.heroWorkout}>{workoutType}</Text> : null}
        </View>

        {isRestDay ? (
          <View style={styles.restCard}>
            <Text style={styles.restEmoji}>🧘</Text>
            <Text style={styles.restTitle}>Rest Day! No workout scheduled.</Text>
            <Text style={styles.restDescription}>
              Keep the momentum with light movement, stretching, or a walk. Recovery keeps your streak alive.
            </Text>
          </View>
        ) : null}

        {!isRestDay && workoutNotes.trim().length > 0 ? (
          <View style={styles.notesCard}>
            <Text style={styles.notesTitle}>Coach Notes</Text>
            <Text style={styles.notesBody}>{workoutNotes}</Text>
          </View>
        ) : null}

        {!isRestDay && hasExercises ? (
          <View style={styles.exercisesSection}>
            <Text style={styles.sectionTitle}>Workout Breakdown</Text>
            <View style={styles.exercisesCard}>
              {parsedSets.map((exercise) => {
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

        {!isRestDay && !hasExercises ? (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyTitle}>No exercises assigned.</Text>
            <Text style={styles.emptySubtitle}>Your coach hasn&apos;t programmed sets for this day yet.</Text>
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
  notesCard: {
    padding: 24,
    borderRadius: 24,
    backgroundColor: "#131313",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
    gap: 12,
  },
  notesTitle: {
    fontSize: 15,
    fontWeight: "700" as const,
    color: Colors.text,
  },
  notesBody: {
    fontSize: 14,
    color: "rgba(255,255,255,0.75)",
    lineHeight: 20,
  },
  emptyCard: {
    padding: 24,
    borderRadius: 24,
    backgroundColor: "#18181b",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.05)",
    gap: 8,
    alignItems: "flex-start",
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: "700" as const,
    color: Colors.text,
  },
  emptySubtitle: {
    fontSize: 14,
    color: Colors.textSecondary,
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
