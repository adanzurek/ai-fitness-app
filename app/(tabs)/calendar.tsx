import {
  StyleSheet,
  Text,
  View,
  ScrollView,
  TouchableOpacity,
  Platform,
} from "react-native";
import Colors from "@/constants/colors";
import { useEffect, useMemo, useState } from "react";
import { WorkoutType } from "@/types/fitness";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import MonthlyCalendar from "@/components/MonthlyCalendar";
import WorkoutEditorSheet from "@/components/WorkoutEditorSheet";
import { useMonthlyWorkouts } from "@/hooks/useMonthlyWorkouts";

function getWorkoutColors(type: WorkoutType | string | null) {
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

function formatLocalISO(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export default function CalendarScreen() {
  const insets = useSafeAreaInsets();
  const [currentDate, setCurrentDate] = useState(() => {
    const today = new Date();
    return new Date(today.getFullYear(), today.getMonth(), 1);
  });
  const [selectedDate, setSelectedDate] = useState(() => formatLocalISO(new Date()));
  const [showEditor, setShowEditor] = useState(false);
  const [editingDate, setEditingDate] = useState<string>("");

  const currentYear = currentDate.getFullYear();
  const currentMonth = currentDate.getMonth();

  const { days, loading, error } = useMonthlyWorkouts({ year: currentYear, month: currentMonth });

  useEffect(() => {
    setSelectedDate(formatLocalISO(new Date(currentYear, currentMonth, 1)));
  }, [currentYear, currentMonth]);

  const selectedDay = useMemo(() => days.find((day) => day.date === selectedDate), [days, selectedDate]);

  const handleSelectDate = (dateISO: string) => {
    setSelectedDate(dateISO);
    setEditingDate(dateISO);
    setShowEditor(true);
  };

  const changeMonth = (delta: number) => {
    setCurrentDate((prev) => {
      const next = new Date(prev);
      next.setMonth(prev.getMonth() + delta);
      return next;
    });
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
        <View style={styles.monthNav}>
          <TouchableOpacity style={styles.monthNavButton} onPress={() => changeMonth(-1)}>
            <Text style={styles.monthNavText}>Prev</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.monthNavButton} onPress={() => changeMonth(1)}>
            <Text style={styles.monthNavText}>Next</Text>
          </TouchableOpacity>
        </View>
        <MonthlyCalendar
          year={currentYear}
          month={currentMonth}
          days={days}
          loading={loading}
          error={error}
          onSelectDate={handleSelectDate}
        />

        {selectedDay ? (
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
                    {new Date(selectedDate).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                  </Text>
                  <View
                    style={[styles.workoutTypePill, { backgroundColor: getWorkoutColors((selectedDay.workouts[0]?.type as WorkoutType) || "Rest").bg }]}
                  >
                    <Text
                      style={[
                        styles.workoutTypePillText,
                        { color: getWorkoutColors((selectedDay.workouts[0]?.type as WorkoutType) || "Rest").text },
                      ]}
                    >
                      {selectedDay.workouts[0]?.type ?? "Session"}
                    </Text>
                  </View>
                </View>
              </View>

              <Text style={styles.workoutTitle}>Scheduled Workouts</Text>
              <Text style={styles.workoutDescription}>
                {selectedDay.workouts.length} session{selectedDay.workouts.length === 1 ? "" : "s"} planned for this day.
              </Text>

              <View style={styles.exercisesList}>
                {selectedDay.workouts.map((workout) => (
                  <View key={workout.workout_id} style={styles.setRow}>
                    <View style={styles.setRowLeft}>
                      <Text style={styles.exerciseName}>{workout.type ?? "Session"}</Text>
                      {workout.notes ? (
                        <Text style={styles.setTarget}>{workout.notes}</Text>
                      ) : (
                        <Text style={styles.setTarget}>No notes provided.</Text>
                      )}
                    </View>
                    <View style={styles.setActions}>
                      <TouchableOpacity style={[styles.actionButton, styles.actionButtonDone]} activeOpacity={0.7}>
                        <Text style={styles.actionButtonText}>🗓️</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                ))}
              </View>
            </LinearGradient>
          </View>
        ) : (
          <View style={styles.restCard}>
            <Text style={styles.restEmoji}>✨</Text>
            <Text style={styles.restTitle}>Rest Day</Text>
            <Text style={styles.restText}>Recovery matters. Light walk or mobility work recommended.</Text>
          </View>
        )}
      </ScrollView>

      <WorkoutEditorSheet visible={showEditor} dateISO={editingDate} onClose={() => setShowEditor(false)} />
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
  monthNav: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 12,
  },
  monthNavButton: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  monthNavText: {
    color: Colors.text,
    fontWeight: "600" as const,
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
  actionButtonText: {
    fontSize: 18,
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
