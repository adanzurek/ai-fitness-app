import { Stack, useLocalSearchParams } from "expo-router";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { useMemo } from "react";
import Colors from "@/constants/colors";
import { Dumbbell } from "lucide-react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

const CARD_HORIZONTAL_PADDING = 20;

type WorkoutSet = {
  id: string;
  name: string;
  exerciseKey: string;
  sets?: number | null;
  reps?: number | string | null;
  rir?: number | null;
  weight?: number | string | null;
};

function parseLocalISODate(dateISO: string) {
  if (!dateISO) {
    return null;
  }
  const [year, month, day] = dateISO.split("-").map((segment) => Number(segment));
  if ([year, month, day].some((value) => Number.isNaN(value))) {
    return null;
  }
  return new Date(year, month - 1, day);
}

function formatFriendlyDate(dateISO: string) {
  const localDate = parseLocalISODate(dateISO);
  if (!localDate) {
    return "Unknown date";
  }
  return localDate.toLocaleDateString("en-US", {
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

function resolveName(candidate: Record<string, unknown>): string | null {
  if (typeof candidate.name === "string") {
    return candidate.name;
  }
  if (typeof candidate.exercise_name === "string") {
    return candidate.exercise_name;
  }
  if (typeof candidate.label === "string") {
    return candidate.label;
  }
  return null;
}

function coerceReps(candidate: Record<string, unknown>): number | string | null {
  const source =
    candidate.reps ??
    candidate.target_reps ??
    candidate.prescription ??
    candidate.target_repetitions ??
    null;
  if (typeof source === "number" || typeof source === "string") {
    return source;
  }
  return null;
}

function coerceRir(candidate: Record<string, unknown>): number | null {
  const source = candidate.rir ?? candidate.target_rir ?? null;
  return typeof source === "number" ? source : null;
}

function coerceWeight(candidate: Record<string, unknown>): number | string | null {
  const source = candidate.weight ?? candidate.target_weight ?? candidate.load ?? null;
  if (typeof source === "number" || typeof source === "string") {
    return source;
  }
  return null;
}

function normalizeSet(candidate: Record<string, unknown>, index: number): WorkoutSet | null {
  const name = resolveName(candidate);
  if (!name) {
    return null;
  }
  const baseId =
    (typeof candidate.id === "string" && candidate.id.length > 0
      ? candidate.id
      : typeof candidate.exercise_id === "string" && candidate.exercise_id.length > 0
        ? candidate.exercise_id
        : null) ?? `${name.replace(/\s+/g, "-").toLowerCase()}`;
  const exerciseKey =
    (typeof candidate.exercise_id === "string" && candidate.exercise_id.length > 0 ? candidate.exercise_id : null) ??
    baseId;
  const sets = typeof candidate.sets === "number" ? candidate.sets : null;
  return {
    id: `${baseId}-${index}`,
    name,
    exerciseKey,
    sets,
    reps: coerceReps(candidate),
    rir: coerceRir(candidate),
    weight: coerceWeight(candidate),
  };
}

function parseSets(rawSets: string): WorkoutSet[] {
  if (!rawSets) {
    return [];
  }
  try {
    const parsed = JSON.parse(rawSets) as unknown;
    if (Array.isArray(parsed)) {
      return parsed.reduce<WorkoutSet[]>((acc, item, index) => {
        if (!item || typeof item !== "object") {
          return acc;
        }
        const normalized = normalizeSet(item as Record<string, unknown>, index);
        if (normalized) {
          acc.push(normalized);
        }
        return acc;
      }, []);
    }
  } catch (error) {
    console.error("[DayView] Failed to parse sets", error);
  }
  return [];
}

type GroupedExercise = {
  key: string;
  name: string;
  totalSets: number;
  repsLabel: string | null;
  weightLabel: string | null;
};

function groupExercises(sets: WorkoutSet[]): GroupedExercise[] {
  const summaries = new Map<string, GroupedExercise>();
  sets.forEach((set) => {
    const key = set.exerciseKey ?? set.id;
    const existing =
      summaries.get(key) ??
      {
        key,
        name: set.name,
        totalSets: 0,
        repsLabel: null,
        weightLabel: null,
      };
    existing.name = set.name || existing.name;
    if (typeof set.sets === "number" && set.sets > 0) {
      existing.totalSets = Math.max(existing.totalSets, set.sets);
    } else {
      existing.totalSets += 1;
    }
    if (!existing.repsLabel && set.reps != null) {
      existing.repsLabel = typeof set.reps === "number" ? `${set.reps} reps` : String(set.reps);
    }
    if (!existing.weightLabel && set.weight != null) {
      existing.weightLabel = typeof set.weight === "number" ? `${set.weight} lbs` : String(set.weight);
    }
    summaries.set(key, existing);
  });
  return Array.from(summaries.values());
}

function formatExerciseMeta(exercise: GroupedExercise) {
  return [
    exercise.totalSets > 0 ? `${exercise.totalSets} set${exercise.totalSets === 1 ? "" : "s"}` : null,
    exercise.repsLabel,
    exercise.weightLabel,
  ]
    .filter(Boolean)
    .join(" · ");
}

export default function DayViewScreen() {
  const params = useLocalSearchParams();
  const insets = useSafeAreaInsets();

  const dateISO = useMemo(() => getParamValue(params.date), [params.date]);
  const isRestParam = useMemo(() => getParamValue(params.isRest), [params.isRest]);
  const workoutIdRaw = useMemo(() => getParamValue(params.workoutId), [params.workoutId]);
  const workoutId = workoutIdRaw.trim();
  const workoutType = useMemo(() => getParamValue(params.type), [params.type]);
  const workoutNotes = useMemo(() => getParamValue(params.notes), [params.notes]);
  const rawSets = useMemo(() => getParamValue(params.sets), [params.sets]);
  const parsedSets = useMemo(() => parseSets(rawSets), [rawSets]);
  const groupedExercises = useMemo(() => groupExercises(parsedSets), [parsedSets]);

  const isRestDay = isRestParam === "true";
  const hasExercises = groupedExercises.length > 0;
  const headerTitle = isRestDay ? "Rest Day" : workoutType || "Day View";
  const friendlyDate = useMemo(() => (dateISO ? formatFriendlyDate(dateISO) : "Unknown date"), [dateISO]);

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
              {groupedExercises.map((exercise, index) => (
                <View
                  key={exercise.key}
                  style={[
                    styles.exerciseRow,
                    index !== groupedExercises.length - 1 && styles.exerciseRowDivider,
                  ]}
                >
                  <View style={styles.exerciseLeft}>
                    <View style={styles.iconWrapper}>
                      <Dumbbell size={20} color={Colors.primary} />
                    </View>
                    <View style={styles.exerciseTextBlock}>
                      <Text style={styles.exerciseName}>{exercise.name}</Text>
                      <Text style={styles.exerciseMeta}>
                        {formatExerciseMeta(exercise) || "Custom work"}
                      </Text>
                    </View>
                  </View>
                </View>
              ))}
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
    alignItems: "center",
    paddingVertical: 18,
    paddingHorizontal: 20,
    gap: 12,
  },
  exerciseRowDivider: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(255,255,255,0.08)",
  },
  exerciseLeft: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 14,
    flex: 1,
  },
  iconWrapper: {
    width: 36,
    height: 36,
    borderRadius: 12,
    backgroundColor: "rgba(255,255,255,0.05)",
    alignItems: "center",
    justifyContent: "center",
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
    lineHeight: 18,
  },
});
