import { StyleSheet, Text, View } from "react-native";
import Colors from "@/constants/colors";
import { TrendingUp, Flame } from "lucide-react-native";

type ProgressCardsProps = {
  trainingStreakDays?: number;
  hasSessionData?: boolean;
};

export default function ProgressCards({
  trainingStreakDays = 0,
  hasSessionData = false,
}: ProgressCardsProps) {
  return (
    <View style={styles.container}>
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <TrendingUp size={24} color={Colors.primary} />
          <Text style={styles.cardTitle}>1RM Progress</Text>
        </View>
        {hasSessionData ? (
          <View style={styles.chartPlaceholder}>
            <Text style={styles.chartText}>
              Training data detected. Detailed charts coming soon.
            </Text>
            <Text style={styles.chartSubtext}>Keep logging sessions to build history.</Text>
          </View>
        ) : (
          <Text style={styles.emptyText}>No session data yet. Start training to see progress!</Text>
        )}
        {/* TODO: Use progress.tm_progress.series to render a sparkline or history chart once ready */}
      </View>

      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <Flame size={24} color={Colors.primary} />
          <Text style={styles.cardTitle}>Training Streak</Text>
        </View>
        <View style={styles.streakContent}>
          <Text style={styles.streakNumber}>{trainingStreakDays}</Text>
          <Text style={styles.streakLabel}>
            {trainingStreakDays === 1 ? "consecutive day" : "consecutive days"}
          </Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: 16,
  },
  card: {
    backgroundColor: Colors.cardBackground,
    padding: 20,
    borderRadius: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 5,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 16,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: '700' as const,
    color: Colors.text,
  },
  chartPlaceholder: {
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  chartText: {
    fontSize: 14,
    color: Colors.textSecondary,
    marginBottom: 8,
  },
  chartSubtext: {
    fontSize: 16,
    fontWeight: '700' as const,
    color: Colors.primary,
  },
  emptyText: {
    fontSize: 14,
    color: Colors.textSecondary,
    textAlign: 'center',
    paddingVertical: 20,
  },
  streakContent: {
    alignItems: 'center',
    paddingVertical: 12,
  },
  streakNumber: {
    fontSize: 48,
    fontWeight: '700' as const,
    color: Colors.primary,
    marginBottom: 8,
  },
  streakLabel: {
    fontSize: 14,
    color: Colors.textSecondary,
  },
});
