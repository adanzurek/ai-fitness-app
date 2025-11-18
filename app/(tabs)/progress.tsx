import { StyleSheet, Text, View, ScrollView, Platform, ActivityIndicator } from "react-native";
import { TrendingUp, Award } from "lucide-react-native";
import Colors from "@/constants/colors";
import { LinearGradient } from "expo-linear-gradient";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import ProgressCards from "@/components/ProgressCards";
import { useEffect, useState } from "react";
import { supabase, isSupabaseConfigured } from "@/lib/supabase";

type StrengthSummary = {
  primary_goal: {
    exercise_name: string;
    exercise_id: string;
    current_1rm: number;
    target_1rm: number;
    to_go: number;
    eta_weeks: number | null;
    progress_pct: number;
  } | null;
  top_movers: {
    exercise_id: string;
    exercise_name: string;
    delta_8_weeks: number;
    current_1rm: number;
  }[];
  recent_prs: {
    exercise_id: string | null;
    exercise_name: string;
    created_at: string;
    pr_type: string | null;
  }[];
};

type ProgressSummaryResponse = {
  ok: boolean;
  streak: {
    current: number;
  };
  month: {
    workouts: number;
    hours: number;
    consistency_pct: number;
    prs: number;
  };
  supabase_progress: {
    has_session_data: boolean;
    training_streak_days: number;
  };
  tm_progress: {
    has_data: boolean;
    series: {
      exercise_id: string;
      week_start: string;
      training_max: number;
    }[];
  };
  strength_summary?: StrengthSummary | null;
};

function formatDate(dateISO: string) {
  try {
    const date = new Date(dateISO);
    return date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
    });
  } catch {
    return dateISO;
  }
}

export default function ProgressScreen() {
  const insets = useSafeAreaInsets();
  const [progress, setProgress] = useState<ProgressSummaryResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;

    const fetchProgress = async () => {
      if (!isSupabaseConfigured) {
        setError("Supabase not configured.");
        setLoading(false);
        return;
      }

      setLoading(true);
      setError(null);

      const { data, error: fnError } = await supabase.functions.invoke<ProgressSummaryResponse>(
        "progress_summary",
        { body: {} },
      );

      if (!isMounted) {
        return;
      }

      if (fnError) {
        console.error("progress_summary error", fnError);
        setError("Failed to load progress");
        setProgress(null);
      } else if (data?.ok) {
        setProgress(data);
      } else {
        setError("Unexpected response from server");
        setProgress(null);
      }

      setLoading(false);
    };

    fetchProgress();

    return () => {
      isMounted = false;
    };
  }, []);

  const streakCount = progress?.streak.current ?? 0;
  const monthStats = progress?.month;
  const strength = progress?.strength_summary;
  const primaryGoal = strength?.primary_goal ?? null;
  const topMovers = strength?.top_movers ?? [];
  const recentPrs = strength?.recent_prs ?? [];

  if (loading) {
    return (
      <View style={[styles.loadingContainer, { paddingTop: insets.top + 60 }]}>
        <ActivityIndicator size="large" color={Colors.primary} />
        <Text style={styles.loadingText}>Loading progress…</Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: insets.bottom + 100 }}>
      <View style={[styles.header, { paddingTop: Platform.OS === "web" ? 20 : insets.top + 20 }]}>
        <Text style={styles.title}>Your Progress</Text>
        <Text style={styles.subtitle}>Track your journey to greatness</Text>
      </View>

      {error ? (
        <View style={styles.errorBanner}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      ) : null}

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
          <Text style={styles.streakNumber}>{streakCount}</Text>
          <Text style={styles.streakLabel}>Day Streak</Text>
          <Text style={styles.streakSubtext}>Keep it going!</Text>
        </LinearGradient>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Strength Highlights</Text>
        {primaryGoal ? (
          <View style={styles.primaryGoalCard}>
            <View style={styles.primaryGoalHeader}>
              <Text style={styles.primaryGoalTitle}>{primaryGoal.exercise_name}</Text>
              <View style={styles.goalBadge}>
                <Text style={styles.goalPercent}>{Math.round(primaryGoal.progress_pct)}%</Text>
              </View>
            </View>
            <View style={styles.goalMetricRow}>
              <View style={styles.goalMetric}>
                <Text style={styles.goalMetricLabel}>Current</Text>
                <Text style={styles.goalMetricValue}>{primaryGoal.current_1rm} lbs</Text>
              </View>
              <View style={styles.goalMetric}>
                <Text style={styles.goalMetricLabel}>Target</Text>
                <Text style={styles.goalMetricValue}>{primaryGoal.target_1rm} lbs</Text>
              </View>
              <View style={styles.goalMetric}>
                <Text style={styles.goalMetricLabel}>To go</Text>
                <Text style={styles.goalMetricValue}>{primaryGoal.to_go} lbs</Text>
              </View>
            </View>
            <View style={styles.primaryGoalFooter}>
              <TrendingUp size={16} color={Colors.success} />
              <Text style={styles.primaryGoalSubtitle}>
                {typeof primaryGoal.eta_weeks === "number"
                  ? `~${primaryGoal.eta_weeks} weeks to goal`
                  : "Keep stacking plates"}
              </Text>
            </View>
          </View>
        ) : (
          <View style={styles.primaryGoalCard}>
            <Text style={styles.primaryGoalTitle}>Primary Goal</Text>
            <Text style={styles.emptyText}>
              Set a target exercise in your goals to see a primary strength goal here.
            </Text>
          </View>
        )}

        {topMovers.length > 0 ? (
          <>
            <Text style={styles.sectionSubtitle}>Top movers (last 8 weeks)</Text>
            <View style={styles.topMoversRow}>
              {topMovers.slice(0, 2).map((mover) => (
                <View key={mover.exercise_id} style={styles.moverCard}>
                  <Text style={styles.moverTitle}>{mover.exercise_name}</Text>
                  <Text style={styles.moverDelta}>+{mover.delta_8_weeks} lbs</Text>
                  <Text style={styles.moverLabel}>Last 8 weeks</Text>
                  <Text style={styles.moverSecondary}>Current TM: {mover.current_1rm} lbs</Text>
                </View>
              ))}
            </View>
          </>
        ) : (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyText}>Train consistently to see your biggest movers here.</Text>
          </View>
        )}

        <Text style={styles.sectionSubtitle}>Recent PRs</Text>
        {recentPrs.length > 0 ? (
          <View style={styles.prList}>
            {recentPrs.map((pr) => (
              <View key={`${pr.exercise_name}-${pr.created_at}`} style={styles.prRow}>
                <View style={styles.prRowLeft}>
                  <Text style={styles.prTitle}>{pr.exercise_name}</Text>
                  <Text style={styles.prDate}>{formatDate(pr.created_at)}</Text>
                </View>
                {pr.pr_type ? <Text style={styles.prBadge}>{pr.pr_type}</Text> : null}
              </View>
            ))}
          </View>
        ) : (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyText}>Hit a new PR to see it show up here.</Text>
          </View>
        )}
      </View>

      <View style={styles.statsSection}>
        <Text style={styles.sectionTitle}>This Month</Text>
        <View style={styles.statsGrid}>
          <View style={styles.statCard}>
            <Text style={styles.statNumber}>{monthStats?.workouts ?? 0}</Text>
            <Text style={styles.statLabel}>Workouts</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statNumber}>
              {monthStats ? Number(monthStats.hours.toFixed(1)) : 0}
            </Text>
            <Text style={styles.statLabel}>Hours</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statNumber}>
              {monthStats ? `${Math.round(monthStats.consistency_pct)}%` : "0%"}
            </Text>
            <Text style={styles.statLabel}>Consistency</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statNumber}>{monthStats?.prs ?? 0}</Text>
            <Text style={styles.statLabel}>PRs</Text>
          </View>
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Supabase Progress</Text>
        {/* TODO: Use progress.tm_progress.series to render a sparkline or TM history chart */}
        <ProgressCards
          trainingStreakDays={progress?.supabase_progress.training_streak_days ?? 0}
          hasSessionData={progress?.supabase_progress.has_session_data ?? false}
        />
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
  primaryGoalCard: {
    backgroundColor: Colors.cardBackground,
    padding: 20,
    borderRadius: 20,
    marginBottom: 16,
  },
  primaryGoalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
  },
  primaryGoalTitle: {
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
  goalMetricRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 16,
  },
  goalMetric: {
    flex: 1,
    alignItems: "flex-start",
  },
  goalMetricLabel: {
    fontSize: 12,
    color: Colors.textSecondary,
  },
  goalMetricValue: {
    fontSize: 20,
    fontWeight: "700" as const,
    color: Colors.text,
  },
  primaryGoalFooter: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  primaryGoalSubtitle: {
    color: Colors.textSecondary,
    fontSize: 14,
  },
  sectionSubtitle: {
    fontSize: 16,
    fontWeight: "600" as const,
    color: Colors.text,
    marginBottom: 8,
    marginTop: 8,
  },
  topMoversRow: {
    flexDirection: "row",
    gap: 12,
    marginBottom: 16,
  },
  moverCard: {
    flex: 1,
    backgroundColor: Colors.cardBackground,
    borderRadius: 16,
    padding: 16,
  },
  moverTitle: {
    fontSize: 15,
    fontWeight: "600" as const,
    color: Colors.text,
    marginBottom: 6,
  },
  moverDelta: {
    fontSize: 26,
    fontWeight: "800" as const,
    color: Colors.primary,
  },
  moverLabel: {
    fontSize: 13,
    color: Colors.textSecondary,
    marginBottom: 4,
  },
  moverSecondary: {
    fontSize: 12,
    color: Colors.textSecondary,
  },
  prList: {
    backgroundColor: Colors.cardBackground,
    borderRadius: 20,
  },
  prRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255,255,255,0.05)",
  },
  prRowLeft: {
    flex: 1,
  },
  prTitle: {
    fontSize: 15,
    fontWeight: "600" as const,
    color: Colors.text,
  },
  prDate: {
    fontSize: 12,
    color: Colors.textSecondary,
  },
  prBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: "rgba(255,255,255,0.08)",
    color: Colors.text,
    fontSize: 12,
    fontWeight: "600" as const,
  },
  emptyCard: {
    backgroundColor: Colors.cardBackground,
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
  },
  emptyText: {
    color: Colors.textSecondary,
    fontSize: 14,
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
  loadingContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "flex-start",
    backgroundColor: Colors.background,
  },
  loadingText: {
    marginTop: 12,
    color: Colors.textSecondary,
    fontSize: 14,
  },
  errorBanner: {
    marginHorizontal: 20,
    marginBottom: 12,
    padding: 12,
    borderRadius: 12,
    backgroundColor: "rgba(255, 99, 71, 0.15)",
    borderWidth: 1,
    borderColor: "rgba(255, 99, 71, 0.4)",
  },
  errorText: {
    color: Colors.text,
    fontSize: 14,
  },
});
