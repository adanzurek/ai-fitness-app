import { StyleSheet, Text, View, ScrollView, Platform } from "react-native";
import { useFitness } from "@/contexts/FitnessContext";
import { TrendingUp, Award, Target } from "lucide-react-native";
import Colors from "@/constants/colors";
import { LinearGradient } from "expo-linear-gradient";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import ProgressCards from "@/components/ProgressCards";

export default function ProgressScreen() {
  const { userProfile } = useFitness();
  const insets = useSafeAreaInsets();

  return (
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: insets.bottom + 100 }}>
      <View style={[styles.header, { paddingTop: Platform.OS === "web" ? 20 : insets.top + 20 }]}>
        <Text style={styles.title}>Your Progress</Text>
        <Text style={styles.subtitle}>Track your journey to greatness</Text>
      </View>

      <View style={styles.streakCard}>
        <LinearGradient
          colors={[Colors.primary, Colors.primaryDark]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.streakGradient}
        >
          <View style={styles.streakIcon}>
            <Award size={32} color={Colors.text} />
          </View>
          <Text style={styles.streakNumber}>{userProfile.streak}</Text>
          <Text style={styles.streakLabel}>Day Streak</Text>
          <Text style={styles.streakSubtext}>Keep it going!</Text>
        </LinearGradient>
      </View>

      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Target size={20} color={Colors.primary} />
          <Text style={styles.sectionTitle}>Strength Goals</Text>
        </View>

        {userProfile.goals.map((goal) => {
          const progress = (goal.current / goal.target) * 100;
          const remaining = goal.target - goal.current;
          
          return (
            <View key={goal.id} style={styles.goalCard}>
              <View style={styles.goalHeader}>
                <Text style={styles.goalExercise}>{goal.exercise}</Text>
                <View style={styles.goalBadge}>
                  <Text style={styles.goalPercent}>{Math.round(progress)}%</Text>
                </View>
              </View>

              <View style={styles.goalStats}>
                <View style={styles.goalStat}>
                  <Text style={styles.goalStatLabel}>Current</Text>
                  <Text style={styles.goalStatValue}>{goal.current} {goal.unit}</Text>
                </View>
                <View style={styles.goalStatDivider} />
                <View style={styles.goalStat}>
                  <Text style={styles.goalStatLabel}>Target</Text>
                  <Text style={styles.goalStatValue}>{goal.target} {goal.unit}</Text>
                </View>
                <View style={styles.goalStatDivider} />
                <View style={styles.goalStat}>
                  <Text style={styles.goalStatLabel}>To Go</Text>
                  <Text style={styles.goalStatValue}>{remaining} {goal.unit}</Text>
                </View>
              </View>

              <View style={styles.progressBarContainer}>
                <View style={styles.progressBarTrack}>
                  <LinearGradient
                    colors={[Colors.primary, Colors.primaryDark]}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                    style={[styles.progressBarFill, { width: `${Math.min(progress, 100)}%` }]}
                  />
                </View>
              </View>

              <View style={styles.projectionContainer}>
                <TrendingUp size={14} color={Colors.success} />
                <Text style={styles.projectionText}>
                  At current pace, you&apos;ll hit {goal.target} {goal.unit} in ~8 weeks
                </Text>
              </View>
            </View>
          );
        })}
      </View>

      <View style={styles.statsSection}>
        <Text style={styles.sectionTitle}>This Month</Text>
        <View style={styles.statsGrid}>
          <View style={styles.statCard}>
            <Text style={styles.statNumber}>12</Text>
            <Text style={styles.statLabel}>Workouts</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statNumber}>18.5</Text>
            <Text style={styles.statLabel}>Hours</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statNumber}>100%</Text>
            <Text style={styles.statLabel}>Consistency</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statNumber}>+8</Text>
            <Text style={styles.statLabel}>PRs</Text>
          </View>
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Supabase Progress</Text>
        <ProgressCards />
      </View>

    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  header: {
    padding: 20,
    paddingTop: Platform.OS === "web" ? 20 : 10,
  },
  title: {
    fontSize: 32,
    fontWeight: "700" as const,
    color: Colors.text,
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 16,
    color: Colors.textSecondary,
  },
  streakCard: {
    marginHorizontal: 20,
    marginBottom: 24,
    borderRadius: 20,
    overflow: "hidden",
  },
  streakGradient: {
    padding: 32,
    alignItems: "center",
  },
  streakIcon: {
    marginBottom: 16,
  },
  streakNumber: {
    fontSize: 64,
    fontWeight: "700" as const,
    color: Colors.text,
    marginBottom: 8,
  },
  streakLabel: {
    fontSize: 20,
    fontWeight: "600" as const,
    color: Colors.text,
    marginBottom: 4,
  },
  streakSubtext: {
    fontSize: 14,
    color: "rgba(255, 255, 255, 0.8)",
  },
  section: {
    paddingHorizontal: 20,
    marginBottom: 24,
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: "700" as const,
    color: Colors.text,
  },
  goalCard: {
    backgroundColor: Colors.cardBackground,
    padding: 20,
    borderRadius: 16,
    marginBottom: 16,
  },
  goalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
  },
  goalExercise: {
    fontSize: 18,
    fontWeight: "700" as const,
    color: Colors.text,
  },
  goalBadge: {
    backgroundColor: Colors.primary,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
  },
  goalPercent: {
    fontSize: 14,
    fontWeight: "700" as const,
    color: Colors.text,
  },
  goalStats: {
    flexDirection: "row",
    justifyContent: "space-around",
    marginBottom: 20,
  },
  goalStat: {
    alignItems: "center",
  },
  goalStatLabel: {
    fontSize: 12,
    color: Colors.textSecondary,
    marginBottom: 4,
  },
  goalStatValue: {
    fontSize: 18,
    fontWeight: "700" as const,
    color: Colors.text,
  },
  goalStatDivider: {
    width: 1,
    backgroundColor: Colors.border,
  },
  progressBarContainer: {
    marginBottom: 12,
  },
  progressBarTrack: {
    height: 12,
    backgroundColor: Colors.background,
    borderRadius: 6,
    overflow: "hidden",
  },
  progressBarFill: {
    height: "100%",
    borderRadius: 6,
  },
  projectionContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  projectionText: {
    fontSize: 13,
    color: Colors.success,
  },
  statsSection: {
    paddingHorizontal: 20,
    marginBottom: 24,
  },
  statsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
    marginTop: 16,
  },
  statCard: {
    flex: 1,
    minWidth: "45%",
    backgroundColor: Colors.cardBackground,
    padding: 20,
    borderRadius: 16,
    alignItems: "center",
  },
  statNumber: {
    fontSize: 32,
    fontWeight: "700" as const,
    color: Colors.primary,
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 14,
    color: Colors.textSecondary,
  },
  bottomPadding: {
    height: 20,
  },
});
