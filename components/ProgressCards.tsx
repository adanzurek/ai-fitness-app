import { StyleSheet, Text, View, ActivityIndicator } from 'react-native';
import { useEffect, useState } from 'react';
import { supabase, isSupabaseConfigured } from '@/lib/supabase';
import { useSupabaseUser } from '@/hooks/useSupabaseUser';
import Colors from '@/constants/colors';
import { TrendingUp, Flame } from 'lucide-react-native';

interface SessionData {
  lift: string;
  weight: number[];
  reps: number[];
  started_at: string;
}

interface OneRMData {
  date: string;
  lift: string;
  estimated1RM: number;
}

function calculateEpley1RM(weight: number, reps: number): number {
  if (reps === 1) return weight;
  return weight * (1 + reps / 30);
}

export default function ProgressCards() {
  const { user } = useSupabaseUser();
  const [loading, setLoading] = useState(true);
  const [oneRMData, setOneRMData] = useState<OneRMData[]>([]);
  const [streak, setStreak] = useState(0);

  useEffect(() => {
    if (!user || !isSupabaseConfigured) {
      setOneRMData([]);
      setStreak(0);
      setLoading(false);
      return;
    }

    const fetchProgress = async () => {
      setLoading(true);
      try {
        const ninetyDaysAgo = new Date();
        ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);

        const { data: sessions, error } = await supabase
          .from('sessions')
          .select('lift, weight, reps, started_at')
          .eq('user_id', user.id)
          .gte('started_at', ninetyDaysAgo.toISOString())
          .order('started_at', { ascending: true });

        if (error) throw error;

        const oneRMByDay: Record<string, number> = {};

        (sessions as SessionData[]).forEach((session) => {
          const date = session.started_at.split('T')[0];
          session.weight.forEach((weight, idx) => {
            const reps = session.reps[idx];
            if (weight && reps) {
              const oneRM = calculateEpley1RM(weight, reps);
              const key = `${date}-${session.lift}`;
              if (!oneRMByDay[key] || oneRMByDay[key] < oneRM) {
                oneRMByDay[key] = oneRM;
              }
            }
          });
        });

        const oneRMArray: OneRMData[] = Object.entries(oneRMByDay).map(([key, value]) => {
          const parts = key.split('-');
          const lift = parts.slice(1).join('-');
          const date = parts[0];
          return { date, lift, estimated1RM: value };
        });

        setOneRMData(oneRMArray);

        const uniqueDates = new Set(
          (sessions as SessionData[]).map((s) => s.started_at.split('T')[0])
        );
        const sortedDates = Array.from(uniqueDates).sort();

        let currentStreak = 0;
        const today = new Date().toISOString().split('T')[0];
        let checkDate = new Date(today);

        while (true) {
          const checkStr = checkDate.toISOString().split('T')[0];
          if (sortedDates.includes(checkStr)) {
            currentStreak++;
            checkDate.setDate(checkDate.getDate() - 1);
          } else {
            break;
          }
        }

        setStreak(currentStreak);
      } catch (error) {
        console.error('Failed to fetch progress:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchProgress();
  }, [user]);

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={Colors.primary} />
      </View>
    );
  }

  const lifts = Array.from(new Set(oneRMData.map((d) => d.lift)));
  const firstLift = lifts[0];
  const firstLiftData = oneRMData.filter((d) => d.lift === firstLift);

  return (
    <View style={styles.container}>
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <TrendingUp size={24} color={Colors.primary} />
          <Text style={styles.cardTitle}>1RM Progress</Text>
        </View>
        {firstLiftData.length > 0 ? (
          <View>
            <Text style={styles.liftName}>{firstLift}</Text>
            <View style={styles.chartPlaceholder}>
              <Text style={styles.chartText}>
                {firstLiftData.length} data points over 90 days
              </Text>
              <Text style={styles.chartSubtext}>
                Latest: {Math.round(firstLiftData[firstLiftData.length - 1].estimated1RM)} lbs
              </Text>
            </View>
          </View>
        ) : (
          <Text style={styles.emptyText}>No session data yet. Start training to see progress!</Text>
        )}
      </View>

      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <Flame size={24} color={Colors.primary} />
          <Text style={styles.cardTitle}>Training Streak</Text>
        </View>
        <View style={styles.streakContent}>
          <Text style={styles.streakNumber}>{streak}</Text>
          <Text style={styles.streakLabel}>
            {streak === 1 ? 'consecutive day' : 'consecutive days'}
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
  loadingContainer: {
    paddingVertical: 60,
    alignItems: 'center',
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
  liftName: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: Colors.textSecondary,
    marginBottom: 12,
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
