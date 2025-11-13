import { useMemo } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  Dimensions,
  ActivityIndicator,
} from 'react-native';
import { ChevronLeft, ChevronRight } from 'lucide-react-native';
import { useMonthlyWorkouts, CalendarDay } from '../hooks/useMonthlyWorkouts';
import Colors from '../constants/colors';

const { width } = Dimensions.get('window');
const CALENDAR_PADDING = 16;
const DAY_SIZE = (width - CALENDAR_PADDING * 2 - 6 * 8) / 7;

type WorkoutTypeColors = {
  bg: string;
  text: string;
};

type StatusVisual = {
  backgroundColor: string;
  borderColor: string;
};

function getWorkoutColors(block: string | null | undefined): WorkoutTypeColors {
  if (!block) {
    return { bg: 'rgba(239, 68, 68, 0.15)', text: '#DC2626' };
  }

  const blockLower = block.toLowerCase();
  if (blockLower.includes('upper')) {
    return { bg: 'rgba(239, 68, 68, 0.15)', text: '#DC2626' };
  }
  if (blockLower.includes('lower')) {
    return { bg: 'rgba(59, 130, 246, 0.15)', text: '#2563EB' };
  }
  if (blockLower.includes('push')) {
    return { bg: 'rgba(234, 179, 8, 0.15)', text: '#CA8A04' };
  }
  if (blockLower.includes('pull')) {
    return { bg: 'rgba(34, 197, 94, 0.15)', text: '#16A34A' };
  }
  if (blockLower.includes('legs')) {
    return { bg: 'rgba(168, 85, 247, 0.15)', text: '#9333EA' };
  }
  if (blockLower.includes('rest')) {
    return { bg: 'rgba(156, 163, 175, 0.4)', text: '#6B7280' };
  }
  return { bg: 'rgba(239, 68, 68, 0.15)', text: '#DC2626' };
}

function getStatusVisuals(status: CalendarDay['status']): StatusVisual {
  if (status === 'completed') {
    return { backgroundColor: 'rgba(16, 185, 129, 0.18)', borderColor: Colors.success };
  }
  if (status === 'skipped') {
    return { backgroundColor: 'rgba(239, 68, 68, 0.18)', borderColor: '#EF4444' };
  }
  return { backgroundColor: 'rgba(255, 255, 255, 0.06)', borderColor: 'rgba(255, 255, 255, 0.12)' };
}

function getDaysInMonth(year: number, month: number): Date[] {
  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);
  const daysInMonth = lastDay.getDate();
  const startDayOfWeek = firstDay.getDay();

  const days: Date[] = [];

  for (let i = 0; i < startDayOfWeek; i += 1) {
    const prevDate = new Date(year, month, -startDayOfWeek + i + 1);
    days.push(prevDate);
  }

  for (let i = 1; i <= daysInMonth; i += 1) {
    days.push(new Date(year, month, i));
  }

  const trailingDays = 7 - (days.length % 7);
  if (trailingDays < 7) {
    for (let i = 1; i <= trailingDays; i += 1) {
      days.push(new Date(year, month + 1, i));
    }
  }

  return days;
}

interface MonthlyCalendarProps {
  year: number;
  month: number;
  onEdit?: (dayISO: string) => void;
  onMonthChange?: (year: number, month: number) => void;
}

export default function MonthlyCalendar({ year, month, onEdit, onMonthChange }: MonthlyCalendarProps) {
  const { days, loading, error } = useMonthlyWorkouts({ year, month });

  const workoutsByDate = useMemo(() => {
    return days.reduce<Record<string, CalendarDay>>((acc, dayEntry) => {
      acc[dayEntry.date] = dayEntry;
      return acc;
    }, {});
  }, [days]);

  const monthName = useMemo(() => {
    return new Date(year, month, 1).toLocaleDateString('en-US', {
      month: 'long',
      year: 'numeric',
    });
  }, [year, month]);

  const calendarDays = useMemo(() => getDaysInMonth(year, month), [year, month]);

  const today = new Date();
  const todayStr = today.toISOString().split('T')[0];

  const handleShiftMonth = (delta: number) => {
    const next = new Date(year, month + delta, 1);
    onMonthChange?.(next.getFullYear(), next.getMonth());
  };

  return (
    <View style={styles.container} testID="monthly-calendar">
      <View style={styles.calendarHeader}>
        <TouchableOpacity
          testID="calendar-previous-month"
          style={styles.monthNavButton}
          onPress={() => handleShiftMonth(-1)}
          activeOpacity={0.7}
        >
          <ChevronLeft color={Colors.text} size={18} />
        </TouchableOpacity>
        <Text style={styles.monthTitle}>{monthName}</Text>
        <TouchableOpacity
          testID="calendar-next-month"
          style={styles.monthNavButton}
          onPress={() => handleShiftMonth(1)}
          activeOpacity={0.7}
        >
          <ChevronRight color={Colors.text} size={18} />
        </TouchableOpacity>
      </View>

      {error && (
        <View style={styles.errorBanner}>
          <Text style={styles.errorText}>Couldn’t load workouts for this month.</Text>
        </View>
      )}

      <View style={styles.calendarBody}>
        <View style={styles.weekdayRow}>
          {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((dayLabel) => (
            <View key={dayLabel} style={[styles.weekdayCell, { width: DAY_SIZE }]}>
              <Text style={styles.weekdayText}>{dayLabel}</Text>
            </View>
          ))}
        </View>

        <View style={styles.daysGrid}>
          {calendarDays.map((date) => {
            const dateStr = date.toISOString().split('T')[0];
            const isCurrentMonth = date.getMonth() === month;
            const isTodayDate = dateStr === todayStr;
            const dayData = workoutsByDate[dateStr];
            const hasWorkouts = (dayData?.workouts?.length ?? 0) > 0;
            const statusVisuals = dayData ? getStatusVisuals(dayData.status) : null;
            const firstWorkoutColors = hasWorkouts ? getWorkoutColors(dayData?.workouts[0]?.type) : null;

            return (
              <TouchableOpacity
                key={dateStr}
                accessibilityRole="button"
                testID={`calendar-day-${dateStr}`}
                style={[styles.dayCell, { width: DAY_SIZE, height: DAY_SIZE }]}
                onPress={() => onEdit?.(dateStr)}
                disabled={!onEdit}
                activeOpacity={0.7}
              >
                <View
                  style={[
                    styles.dayInner,
                    !isCurrentMonth && styles.dayOutsideMonth,
                    isTodayDate && styles.dayToday,
                    hasWorkouts && statusVisuals && {
                      backgroundColor: statusVisuals.backgroundColor,
                      borderColor: statusVisuals.borderColor,
                      borderWidth: 1,
                    },
                  ]}
                >
                  <Text
                    style={[
                      styles.dayNumber,
                      !isCurrentMonth && styles.dayNumberOutside,
                      (isTodayDate || hasWorkouts) && styles.dayNumberActive,
                      hasWorkouts && firstWorkoutColors && { color: firstWorkoutColors.text },
                    ]}
                  >
                    {date.getDate()}
                  </Text>

                  {hasWorkouts && (
                    <View style={styles.workoutBadgeContainer}>
                      {dayData?.workouts.slice(0, 3).map((workout) => {
                        const palette = getWorkoutColors(workout.type);
                        return (
                          <View
                            key={workout.workout_id}
                            style={[styles.workoutBadge, { backgroundColor: palette.bg }]}
                            testID={`calendar-day-${dateStr}-workout-${workout.workout_id}`}
                          >
                            <Text style={[styles.workoutBadgeText, { color: palette.text }]} numberOfLines={1}>
                              {workout.type ?? 'Workout'}
                            </Text>
                          </View>
                        );
                      })}
                      {(dayData?.workouts.length ?? 0) > 3 && (
                        <Text style={styles.additionalWorkoutsText}>
                          +{(dayData?.workouts.length ?? 0) - 3}
                        </Text>
                      )}
                    </View>
                  )}
                </View>
              </TouchableOpacity>
            );
          })}
        </View>

        <View style={styles.legend}>
          {['Upper', 'Lower', 'Push', 'Pull', 'Legs', 'Rest'].map((type) => {
            const palette = getWorkoutColors(type);
            return (
              <View key={type} style={styles.legendItem}>
                <View style={[styles.legendDot, { backgroundColor: palette.text }]} />
                <Text style={styles.legendText}>{type}</Text>
              </View>
            );
          })}
        </View>

        {loading && (
          <View style={styles.loadingOverlay} pointerEvents="none">
            <ActivityIndicator size="small" color={Colors.text} testID="calendar-loading-indicator" />
            <Text style={styles.loadingText}>Loading workouts…</Text>
          </View>
        )}
      </View>
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
    overflow: 'hidden',
  },
  calendarHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  monthNavButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
  },
  monthTitle: {
    fontSize: 20,
    fontWeight: '700' as const,
    color: Colors.text,
  },
  errorBanner: {
    backgroundColor: 'rgba(239, 68, 68, 0.18)',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 10,
    marginBottom: 12,
  },
  errorText: {
    color: '#F87171',
    fontSize: 13,
    fontWeight: '600' as const,
    textAlign: 'center',
  },
  calendarBody: {
    position: 'relative',
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
    paddingHorizontal: 2,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  dayOutsideMonth: {
    opacity: 0.3,
  },
  dayToday: {
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
  workoutBadgeContainer: {
    width: '100%',
    marginTop: 6,
    gap: 4,
    alignItems: 'center',
  },
  workoutBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 8,
    maxWidth: '100%',
  },
  workoutBadgeText: {
    fontSize: 9,
    fontWeight: '600' as const,
    textAlign: 'center',
  },
  additionalWorkoutsText: {
    fontSize: 9,
    fontWeight: '600' as const,
    color: Colors.text,
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
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(10, 10, 10, 0.6)',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderRadius: 16,
  },
  loadingText: {
    fontSize: 12,
    color: Colors.text,
    fontWeight: '600' as const,
  },
});
