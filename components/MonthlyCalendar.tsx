import { StyleSheet, Text, View, TouchableOpacity, Dimensions, ActivityIndicator } from 'react-native';
import { useMonthlyWorkouts } from '@/hooks/useMonthlyWorkouts';
import Colors from '@/constants/colors';

const { width } = Dimensions.get('window');
const CALENDAR_PADDING = 16;
const DAY_SIZE = (width - CALENDAR_PADDING * 2 - 6 * 8) / 7;

type WorkoutTypeColors = {
  bg: string;
  text: string;
};

function getWorkoutColors(block: string): WorkoutTypeColors {
  const blockLower = block.toLowerCase();
  if (blockLower.includes('upper')) {
    return { bg: 'rgba(239, 68, 68, 0.15)', text: '#DC2626' };
  } else if (blockLower.includes('lower')) {
    return { bg: 'rgba(59, 130, 246, 0.15)', text: '#2563EB' };
  } else if (blockLower.includes('push')) {
    return { bg: 'rgba(234, 179, 8, 0.15)', text: '#CA8A04' };
  } else if (blockLower.includes('pull')) {
    return { bg: 'rgba(34, 197, 94, 0.15)', text: '#16A34A' };
  } else if (blockLower.includes('legs')) {
    return { bg: 'rgba(168, 85, 247, 0.15)', text: '#9333EA' };
  } else if (blockLower.includes('rest')) {
    return { bg: 'rgba(156, 163, 175, 0.4)', text: '#6B7280' };
  }
  return { bg: 'rgba(239, 68, 68, 0.15)', text: '#DC2626' };
}

function getDaysInMonth(year: number, month: number): Date[] {
  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);
  const daysInMonth = lastDay.getDate();
  const startDayOfWeek = firstDay.getDay();

  const days: Date[] = [];

  for (let i = 0; i < startDayOfWeek; i++) {
    const prevDate = new Date(year, month, -startDayOfWeek + i + 1);
    days.push(prevDate);
  }

  for (let i = 1; i <= daysInMonth; i++) {
    days.push(new Date(year, month, i));
  }

  const remainingDays = 7 - (days.length % 7);
  if (remainingDays < 7) {
    for (let i = 1; i <= remainingDays; i++) {
      days.push(new Date(year, month + 1, i));
    }
  }

  return days;
}

interface MonthlyCalendarProps {
  year: number;
  month: number;
  onEdit?: (dayISO: string) => void;
}

export default function MonthlyCalendar({ year, month, onEdit }: MonthlyCalendarProps) {
  const { rows: workouts, loading } = useMonthlyWorkouts({ year, month });

  const workoutsByDate: Record<string, { block: string }> = {};
  workouts.forEach((w) => {
    workoutsByDate[w.date] = { block: w.block };
  });

  const calendarDays = getDaysInMonth(year, month);
  const today = new Date();
  const todayStr = today.toISOString().split('T')[0];

  const monthName = new Date(year, month, 1).toLocaleDateString('en-US', {
    month: 'long',
    year: 'numeric',
  });

  return (
    <View style={styles.container}>
      <View style={styles.calendarHeader}>
        <Text style={styles.monthTitle}>{monthName}</Text>
      </View>

      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={Colors.primary} />
        </View>
      ) : (
        <>
          <View style={styles.weekdayRow}>
            {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((day, i) => (
              <View key={i} style={[styles.weekdayCell, { width: DAY_SIZE }]}>
                <Text style={styles.weekdayText}>{day}</Text>
              </View>
            ))}
          </View>

          <View style={styles.daysGrid}>
            {calendarDays.map((date, index) => {
              const dateStr = date.toISOString().split('T')[0];
              const isCurrentMonth = date.getMonth() === month;
              const isTodayDate = dateStr === todayStr;
              const workoutData = workoutsByDate[dateStr];
              const colors = workoutData ? getWorkoutColors(workoutData.block) : null;

              return (
                <TouchableOpacity
                  key={index}
                  style={[styles.dayCell, { width: DAY_SIZE, height: DAY_SIZE }]}
                  onPress={() => onEdit?.(dateStr)}
                  activeOpacity={0.7}
                >
                  <View
                    style={[
                      styles.dayInner,
                      !isCurrentMonth && styles.dayOutsideMonth,
                      isTodayDate && styles.dayToday,
                      workoutData && colors && { backgroundColor: colors.bg },
                    ]}
                  >
                    <Text
                      style={[
                        styles.dayNumber,
                        !isCurrentMonth && styles.dayNumberOutside,
                        (isTodayDate || workoutData) && styles.dayNumberActive,
                        workoutData && colors && { color: colors.text },
                      ]}
                    >
                      {date.getDate()}
                    </Text>
                    {workoutData && (
                      <Text
                        style={[styles.workoutTypeLabel, colors && { color: colors.text }]}
                        numberOfLines={1}
                      >
                        {workoutData.block}
                      </Text>
                    )}
                  </View>
                </TouchableOpacity>
              );
            })}
          </View>

          <View style={styles.legend}>
            {['Upper', 'Lower', 'Push', 'Pull', 'Legs', 'Rest'].map((type) => {
              const colors = getWorkoutColors(type);
              return (
                <View key={type} style={styles.legendItem}>
                  <View style={[styles.legendDot, { backgroundColor: colors.text }]} />
                  <Text style={styles.legendText}>{type}</Text>
                </View>
              );
            })}
          </View>
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: Colors.cardBackground,
    padding: 20,
    borderRadius: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 5,
  },
  calendarHeader: {
    marginBottom: 16,
  },
  monthTitle: {
    fontSize: 20,
    fontWeight: '700' as const,
    color: Colors.text,
  },
  loadingContainer: {
    paddingVertical: 60,
    alignItems: 'center',
  },
  weekdayRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  weekdayCell: {
    alignItems: 'center',
  },
  weekdayText: {
    fontSize: 12,
    fontWeight: '600' as const,
    color: Colors.textMuted,
  },
  daysGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  dayCell: {
    marginBottom: 8,
  },
  dayInner: {
    flex: 1,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 4,
  },
  dayOutsideMonth: {
    opacity: 0.3,
  },
  dayToday: {
    borderWidth: 2,
    borderColor: Colors.primary,
  },
  dayNumber: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: Colors.textSecondary,
  },
  dayNumberOutside: {
    color: Colors.textMuted,
  },
  dayNumberActive: {
    color: Colors.text,
    fontWeight: '700' as const,
  },
  workoutTypeLabel: {
    fontSize: 9,
    fontWeight: '600' as const,
    marginTop: 2,
  },
  legend: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.1)',
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  legendDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  legendText: {
    fontSize: 11,
    color: Colors.textSecondary,
    fontWeight: '500' as const,
  },
});
