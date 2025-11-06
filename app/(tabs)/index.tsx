import {
  StyleSheet,
  Text,
  View,
  ScrollView,
  TouchableOpacity,
  Platform,
} from "react-native";
import { useTodaysWorkout, useFitness } from "@/contexts/FitnessContext";
import Colors from "@/constants/colors";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { Dumbbell, Calendar, Award } from "lucide-react-native";

export default function HomeScreen() {
  const { toggleExerciseComplete, userProfile } = useFitness();
  const todaysWorkout = useTodaysWorkout();
  const insets = useSafeAreaInsets();

  return (
    <View style={styles.container}>
      <View style={[styles.header, { paddingTop: Platform.OS === "web" ? 20 : insets.top + 20 }]}>
        <Text style={styles.greeting}>Hi Champion 👋</Text>
        <Text style={styles.subtitle}>Ready to crush today?</Text>
      </View>

      <ScrollView
        style={styles.scrollView}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 100 }]}
      >
        <View style={styles.streakCard}>
          <LinearGradient
            colors={[Colors.primary, Colors.primaryDark]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.streakGradient}
          >
            <Award size={32} color={Colors.text} />
            <Text style={styles.streakNumber}>{userProfile.streak}</Text>
            <Text style={styles.streakLabel}>Day Streak</Text>
            <Text style={styles.streakSubtext}>Keep it going!</Text>
          </LinearGradient>
        </View>

        {todaysWorkout ? (
          <View style={styles.todayCard}>
            <View style={styles.todayHeader}>
              <View style={styles.todayHeaderLeft}>
                <Calendar size={20} color={Colors.primary} />
                <Text style={styles.todayTitle}>Today&apos;s Workout</Text>
              </View>
              <View style={styles.workoutTypeBadge}>
                <Text style={styles.workoutTypeBadgeText}>{todaysWorkout.type}</Text>
              </View>
            </View>

            <Text style={styles.workoutName}>{todaysWorkout.title}</Text>
            <Text style={styles.workoutDesc}>{todaysWorkout.description}</Text>

            <View style={styles.exercisesList}>
              {todaysWorkout.exercises.map((exercise) => {
                const targetLoad = exercise.weight
                  ? `${exercise.weight} lbs`
                  : "bodyweight";

                return (
                  <View key={exercise.id} style={styles.exerciseCard}>
                    <View style={styles.exerciseHeader}>
                      <View style={styles.exerciseIcon}>
                        <Dumbbell size={20} color={Colors.primary} />
                      </View>
                      <View style={styles.exerciseInfo}>
                        <Text style={styles.exerciseName}>{exercise.name}</Text>
                        <Text style={styles.exerciseTarget}>
                          {exercise.sets} × {exercise.reps} reps @ {targetLoad}
                        </Text>
                      </View>
                    </View>
                    <TouchableOpacity
                      style={[
                        styles.checkButton,
                        exercise.completed && styles.checkButtonComplete,
                      ]}
                      onPress={() =>
                        toggleExerciseComplete(todaysWorkout.id, exercise.id)
                      }
                      activeOpacity={0.7}
                    >
                      <Text style={styles.checkButtonText}>
                        {exercise.completed ? "✓" : ""}
                      </Text>
                    </TouchableOpacity>
                  </View>
                );
              })}
            </View>

            <View style={styles.progressBar}>
              <Text style={styles.progressText}>
                {todaysWorkout.exercises.filter((e) => e.completed).length} /{" "}
                {todaysWorkout.exercises.length} completed
              </Text>
            </View>
          </View>
        ) : (
          <View style={styles.todayCard}>
            <View style={styles.restContent}>
              <Text style={styles.restEmoji}>✨</Text>
              <Text style={styles.restTitle}>Rest Day</Text>
              <Text style={styles.restText}>
                Recovery matters. Take a light walk or do some mobility work.
              </Text>
            </View>
          </View>
        )}

        <View style={styles.goalsSection}>
          <Text style={styles.goalsTitle}>Your Goals</Text>
          {userProfile.goals.slice(0, 2).map((goal) => {
            const progress = (goal.current / goal.target) * 100;
            return (
              <View key={goal.id} style={styles.goalCard}>
                <View style={styles.goalHeader}>
                  <Text style={styles.goalExercise}>{goal.exercise}</Text>
                  <Text style={styles.goalProgress}>{Math.round(progress)}%</Text>
                </View>
                <View style={styles.goalBarTrack}>
                  <View
                    style={[styles.goalBarFill, { width: `${Math.min(progress, 100)}%` }]}
                  />
                </View>
                <View style={styles.goalStats}>
                  <Text style={styles.goalStat}>
                    Current: {goal.current} {goal.unit}
                  </Text>
                  <Text style={styles.goalStat}>
                    Target: {goal.target} {goal.unit}
                  </Text>
                </View>
              </View>
            );
          })}
        </View>
      </ScrollView>
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
  greeting: {
    fontSize: 32,
    fontWeight: "700" as const,
    color: Colors.text,
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 16,
    color: Colors.textSecondary,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 20,
  },
  streakCard: {
    borderRadius: 20,
    overflow: "hidden",
    marginBottom: 20,
  },
  streakGradient: {
    padding: 32,
    alignItems: "center",
  },
  streakNumber: {
    fontSize: 56,
    fontWeight: "700" as const,
    color: Colors.text,
    marginTop: 12,
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
    color: "rgba(255, 255, 255, 0.8)",
  },
  todayCard: {
    backgroundColor: Colors.cardBackground,
    borderRadius: 20,
    padding: 20,
    marginBottom: 20,
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
    fontSize: 16,
    fontWeight: "700" as const,
    color: Colors.text,
  },
  workoutTypeBadge: {
    backgroundColor: Colors.primary,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
  },
  workoutTypeBadgeText: {
    fontSize: 12,
    fontWeight: "600" as const,
    color: Colors.text,
  },
  workoutName: {
    fontSize: 24,
    fontWeight: "700" as const,
    color: Colors.text,
    marginBottom: 8,
  },
  workoutDesc: {
    fontSize: 14,
    color: Colors.textSecondary,
    marginBottom: 20,
    lineHeight: 20,
  },
  exercisesList: {
    gap: 12,
    marginBottom: 20,
  },
  exerciseCard: {
    backgroundColor: Colors.background,
    borderRadius: 16,
    padding: 16,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  exerciseHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    flex: 1,
  },
  exerciseIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: Colors.cardBackground,
    alignItems: "center",
    justifyContent: "center",
  },
  exerciseInfo: {
    flex: 1,
  },
  exerciseName: {
    fontSize: 16,
    fontWeight: "600" as const,
    color: Colors.text,
    marginBottom: 4,
  },
  exerciseTarget: {
    fontSize: 13,
    color: Colors.textSecondary,
  },
  checkButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: Colors.cardBackground,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: Colors.border,
  },
  checkButtonComplete: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  checkButtonText: {
    fontSize: 18,
    fontWeight: "700" as const,
    color: Colors.text,
  },
  progressBar: {
    backgroundColor: Colors.background,
    borderRadius: 12,
    padding: 16,
    alignItems: "center",
  },
  progressText: {
    fontSize: 14,
    fontWeight: "600" as const,
    color: Colors.text,
  },
  restContent: {
    alignItems: "center",
    paddingVertical: 20,
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
  goalsSection: {
    marginBottom: 20,
  },
  goalsTitle: {
    fontSize: 20,
    fontWeight: "700" as const,
    color: Colors.text,
    marginBottom: 16,
  },
  goalCard: {
    backgroundColor: Colors.cardBackground,
    borderRadius: 16,
    padding: 20,
    marginBottom: 12,
  },
  goalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  goalExercise: {
    fontSize: 16,
    fontWeight: "600" as const,
    color: Colors.text,
  },
  goalProgress: {
    fontSize: 16,
    fontWeight: "700" as const,
    color: Colors.primary,
  },
  goalBarTrack: {
    height: 8,
    backgroundColor: Colors.background,
    borderRadius: 4,
    overflow: "hidden",
    marginBottom: 12,
  },
  goalBarFill: {
    height: "100%",
    backgroundColor: Colors.primary,
    borderRadius: 4,
  },
  goalStats: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  goalStat: {
    fontSize: 13,
    color: Colors.textSecondary,
  },
});
