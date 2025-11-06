import {
  StyleSheet,
  Text,
  View,
  ScrollView,
  TouchableOpacity,
  Platform,
} from "react-native";
import { useUpcomingWorkouts, useFitness } from "@/contexts/FitnessContext";
import Colors from "@/constants/colors";
import { useState, useMemo } from "react";
import { WorkoutType } from "@/types/fitness";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import MonthlyCalendar from "@/components/MonthlyCalendar";
import WorkoutEditorSheet from "@/components/WorkoutEditorSheet";

type WorkoutTypeColors = {
  bg: string;
  text: string;
};

function getWorkoutColors(type: WorkoutType): WorkoutTypeColors {
  switch (type) {
    case "Upper":
      return { bg: "rgba(239, 68, 68, 0.15)", text: "#DC2626" };
    case "Lower":
      return { bg: "rgba(59, 130, 246, 0.15)", text: "#2563EB" };
    case "Push":
      return { bg: "rgba(234, 179, 8, 0.15)", text: "#CA8A04" };
    case "Pull":
      return { bg: "rgba(34, 197, 94, 0.15)", text: "#16A34A" };
    case "Legs":
      return { bg: "rgba(168, 85, 247, 0.15)", text: "#9333EA" };
    case "Rest":
      return { bg: "rgba(156, 163, 175, 0.4)", text: "#6B7280" };
    default:
      return { bg: "rgba(239, 68, 68, 0.15)", text: "#DC2626" };
  }
}

export default function CalendarScreen() {
  const { toggleExerciseComplete } = useFitness();
  const upcomingWorkouts = useUpcomingWorkouts();
  const insets = useSafeAreaInsets();

  const today = new Date();
  const [selectedDate, setSelectedDate] = useState<string>(
    today.toISOString().split("T")[0]
  );
  const [currentMonth] = useState<number>(today.getMonth());
  const [currentYear] = useState<number>(today.getFullYear());
  const [showEditor, setShowEditor] = useState(false);
  const [editingDate, setEditingDate] = useState<string>("");

  const selectedWorkout = useMemo(() => {
    return upcomingWorkouts.find((w) => w.date === selectedDate);
  }, [upcomingWorkouts, selectedDate]);

  const todayStr = today.toISOString().split("T")[0];
  const isToday = selectedDate === todayStr;

  const handleEditWorkout = (dateISO: string) => {
    setEditingDate(dateISO);
    setSelectedDate(dateISO);
    setShowEditor(true);
  };

  return (
    <View style={styles.container}>
      <View style={[styles.header, { paddingTop: Platform.OS === "web" ? 20 : insets.top + 20 }]}>
        <Text style={styles.headerTitle}>Calendar</Text>
        <Text style={styles.headerSubtitle}>Your month at a glance</Text>
      </View>

      <ScrollView
        style={styles.scrollView}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 100 }]}
      >
        <MonthlyCalendar
          year={currentYear}
          month={currentMonth}
          onEdit={handleEditWorkout}
        />

        {selectedWorkout ? (
          <View style={styles.workoutCard}>
            <LinearGradient
              colors={["#FFFFFF", "#FEF2F2"]}
              start={{ x: 0, y: 0 }}
              end={{ x: 0, y: 1 }}
              style={styles.workoutGradient}
            >
              <View style={styles.workoutHeader}>
                <View style={styles.workoutHeaderLeft}>
                  <Text style={styles.workoutDate}>
                    {isToday
                      ? "Today"
                      : new Date(selectedDate).toLocaleDateString("en-US", {
                          month: "short",
                          day: "numeric",
                        })}
                  </Text>
                  <View
                    style={[
                      styles.workoutTypePill,
                      {
                        backgroundColor: getWorkoutColors(selectedWorkout.type).bg,
                      },
                    ]}
                  >
                    <Text
                      style={[
                        styles.workoutTypePillText,
                        {
                          color: getWorkoutColors(selectedWorkout.type).text,
                        },
                      ]}
                    >
                      {selectedWorkout.type}
                    </Text>
                  </View>
                </View>
              </View>

              <Text style={styles.workoutTitle}>{selectedWorkout.title}</Text>
              <Text style={styles.workoutDescription}>
                {selectedWorkout.description}
              </Text>

              <View style={styles.exercisesList}>
                {selectedWorkout.exercises.map((exercise) => {
                  const targetReps = exercise.reps;
                  const targetLoad = exercise.weight
                    ? `${exercise.weight} lbs`
                    : "bodyweight";

                  return (
                    <View key={exercise.id} style={styles.setRow}>
                      <View style={styles.setRowLeft}>
                        <Text style={styles.exerciseName}>{exercise.name}</Text>
                        <Text style={styles.setTarget}>
                          Target: {targetReps} reps @ {targetLoad}
                        </Text>
                      </View>
                      <View style={styles.setActions}>
                        <TouchableOpacity
                          style={[
                            styles.actionButton,
                            styles.actionButtonDone,
                            exercise.completed && styles.actionButtonDoneActive,
                          ]}
                          onPress={() =>
                            toggleExerciseComplete(selectedWorkout.id, exercise.id)
                          }
                          activeOpacity={0.7}
                        >
                          <Text
                            style={[
                              styles.actionButtonText,
                              exercise.completed && styles.actionButtonTextActive,
                            ]}
                          >
                            ✅
                          </Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                          style={[styles.actionButton, styles.actionButtonFail]}
                          activeOpacity={0.7}
                        >
                          <Text style={styles.actionButtonText}>⚠️</Text>
                        </TouchableOpacity>
                      </View>
                    </View>
                  );
                })}
              </View>

              <View style={styles.workoutFooter}>
                <View style={styles.progressPill}>
                  <Text style={styles.progressPillText}>
                    {selectedWorkout.exercises.filter((e) => e.completed).length} /{" "}
                    {selectedWorkout.exercises.length} sets
                  </Text>
                </View>
                <TouchableOpacity
                  style={styles.completeButton}
                  activeOpacity={0.8}
                >
                  <Text style={styles.completeButtonText}>Mark Workout Complete</Text>
                </TouchableOpacity>
              </View>
            </LinearGradient>
          </View>
        ) : (
          <View style={styles.restCard}>
            <Text style={styles.restEmoji}>✨</Text>
            <Text style={styles.restTitle}>Rest Day</Text>
            <Text style={styles.restText}>
              Recovery matters. Light walk or mobility work recommended.
            </Text>
          </View>
        )}
      </ScrollView>

      <WorkoutEditorSheet
        visible={showEditor}
        dateISO={editingDate}
        onClose={() => setShowEditor(false)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  header: {
    paddingHorizontal: 20,
    paddingBottom: 20,
    backgroundColor: Colors.background,
  },
  headerTitle: {
    fontSize: 32,
    fontWeight: "700" as const,
    color: Colors.text,
    marginBottom: 4,
  },
  headerSubtitle: {
    fontSize: 16,
    color: Colors.textSecondary,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 16,
  },

  workoutCard: {
    marginBottom: 12,
    borderRadius: 24,
    overflow: "hidden",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 5,
  },
  workoutGradient: {
    padding: 20,
  },
  workoutHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  workoutHeaderLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  workoutDate: {
    fontSize: 16,
    fontWeight: "700" as const,
    color: "#000",
  },
  workoutTypePill: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 99,
  },
  workoutTypePillText: {
    fontSize: 12,
    fontWeight: "600" as const,
  },
  workoutTitle: {
    fontSize: 24,
    fontWeight: "700" as const,
    color: "#000",
    marginBottom: 8,
  },
  workoutDescription: {
    fontSize: 14,
    color: "#6B7280",
    marginBottom: 20,
    lineHeight: 20,
  },
  exercisesList: {
    gap: 12,
    marginBottom: 20,
  },
  setRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    padding: 16,
    borderRadius: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  setRowLeft: {
    flex: 1,
    marginRight: 12,
  },
  exerciseName: {
    fontSize: 16,
    fontWeight: "700" as const,
    color: "#000",
    marginBottom: 4,
  },
  setTarget: {
    fontSize: 13,
    color: "#6B7280",
  },
  setActions: {
    flexDirection: "row",
    gap: 8,
  },
  actionButton: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: "rgba(0, 0, 0, 0.1)",
  },
  actionButtonDone: {
    backgroundColor: "#FFFFFF",
  },
  actionButtonDoneActive: {
    backgroundColor: "#10B981",
    borderColor: "#10B981",
  },
  actionButtonFail: {
    backgroundColor: "#FFFFFF",
  },
  actionButtonText: {
    fontSize: 18,
  },
  actionButtonTextActive: {
    fontSize: 18,
  },
  workoutFooter: {
    gap: 12,
  },
  progressPill: {
    backgroundColor: "rgba(0, 0, 0, 0.05)",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 99,
    alignItems: "center",
  },
  progressPillText: {
    fontSize: 14,
    fontWeight: "600" as const,
    color: "#000",
  },
  completeButton: {
    backgroundColor: "#000",
    paddingVertical: 16,
    borderRadius: 16,
    alignItems: "center",
  },
  completeButtonText: {
    fontSize: 16,
    fontWeight: "700" as const,
    color: "#FFFFFF",
  },
  restCard: {
    backgroundColor: Colors.cardBackground,
    marginBottom: 12,
    padding: 32,
    borderRadius: 24,
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 5,
  },
  restEmoji: {
    fontSize: 48,
    marginBottom: 16,
  },
  restTitle: {
    fontSize: 24,
    fontWeight: "700" as const,
    color: Colors.text,
    marginBottom: 8,
  },
  restText: {
    fontSize: 14,
    color: Colors.textSecondary,
    textAlign: "center",
    lineHeight: 20,
  },
});
