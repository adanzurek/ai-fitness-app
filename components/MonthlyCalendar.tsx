import { useMemo } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import Colors from '@/constants/colors';
import type { CalendarDay } from '@/hooks/useMonthlyWorkouts';

const DAY_COLUMN_PERCENT = `${(1 / 7) * 100}%` as const;

function toStartOfDay(date: Date) {
  const normalized = new Date(date);
  normalized.setHours(0, 0, 0, 0);
  return normalized;
}

function formatLocalISO(date: Date) {
  const normalized = toStartOfDay(date);
  const year = normalized.getFullYear();
  const month = String(normalized.getMonth() + 1).padStart(2, '0');
  const day = String(normalized.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

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
  const firstDay = toStartOfDay(new Date(year, month, 1));
  const lastDay = toStartOfDay(new Date(year, month + 1, 0));
  const totalDays = lastDay.getDate();
  const leading = firstDay.getDay();

  const days: Date[] = [];

  for (let offset = leading; offset > 0; offset -= 1) {
    const prevDate = toStartOfDay(new Date(firstDay));
    prevDate.setDate(firstDay.getDate() - offset);
    days.push(prevDate);
  }

  for (let index = 0; index < totalDays; index += 1) {
    const current = toStartOfDay(new Date(firstDay));
    current.setDate(firstDay.getDate() + index);
    days.push(current);
  }

  const trailing = (7 - (days.length % 7)) % 7;

  for (let offset = 1; offset <= trailing; offset += 1) {
    const nextDate = toStartOfDay(new Date(lastDay));
    nextDate.setDate(lastDay.getDate() + offset);
    days.push(nextDate);
  }

  return days;
}

interface MonthlyCalendarProps {
  year?: number;
  month?: number; // 0-indexed
  days: CalendarDay[];
  loading: boolean;
  error?: Error | null;
  onSelectDate?: (dayISO: string) => void;
  todayOverride?: Date;
  selectedDate?: string;
}

export default function MonthlyCalendar({
  year,
  month,
  days,
  loading,
  error,
  onSelectDate,
  todayOverride,
  selectedDate,
}: MonthlyCalendarProps) {
  const workoutsByDate = useMemo(
    () =>
      days.reduce<Record<string, CalendarDay>>((acc, day) => {
        acc[day.date] = day;
        return acc;
      }, {}),
    [days],
  );

  const systemToday = useMemo(() => toStartOfDay(todayOverride ?? new Date()), [todayOverride]);
  const activeMonthDate = useMemo(() => {
    if (typeof year === 'number' && typeof month === 'number') {
      return toStartOfDay(new Date(year, month, 1));
    }
    return toStartOfDay(new Date(systemToday.getFullYear(), systemToday.getMonth(), 1));
  }, [month, systemToday, year]);

  const activeYear = activeMonthDate.getFullYear();
  const activeMonth = activeMonthDate.getMonth();

  const calendarDays = useMemo(() => getDaysInMonth(activeYear, activeMonth), [activeMonth, activeYear]);
  const todayStr = formatLocalISO(systemToday);
  const resolvedSelectedDate = selectedDate ?? todayStr;

  const monthName = useMemo(
    () =>
      activeMonthDate.toLocaleDateString('en-US', {
        month: 'long',
        year: 'numeric',
      }),
    [activeMonthDate],
  );

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
          {error && (
            <View style={styles.errorBanner}>
              <Text style={styles.errorText}>Couldn&apos;t load workouts for this month.</Text>
            </View>
          )}
          <View style={styles.weekdayRow}>
            {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((dayLabel, index) => (
              <View
                key={dayLabel}
                style={styles.weekdayCell}
                testID={`calendar-weekday-${index}`}
              >
                <Text style={styles.weekdayText}>{dayLabel}</Text>
              </View>
            ))}
          </View>

          <View style={styles.daysGrid}>
            {calendarDays.map((date, index) => {
              const dateStr = formatLocalISO(date);
              const isCurrentMonth = date.getMonth() === activeMonth;
              const isTodayDate = dateStr === todayStr;
              const dayData = workoutsByDate[dateStr];
              const firstWorkoutType = dayData?.workouts?.[0]?.type ?? null;
              const colors = firstWorkoutType ? getWorkoutColors(firstWorkoutType) : null;
              const isSelected = resolvedSelectedDate === dateStr;

              return (
                <TouchableOpacity
                  key={dateStr}
                  style={styles.dayCell}
                  onPress={() => onSelectDate?.(dateStr)}
                  activeOpacity={0.7}
                  testID={`calendar-day-${dateStr}`}
                >
                  <View
                    style={[
                      styles.dayInner,
                      !isCurrentMonth && styles.dayOutsideMonth,
                      isTodayDate && styles.dayToday,
                      isSelected && styles.daySelected,
                      dayData && colors && { backgroundColor: colors.bg },
                    ]}
                  >
                    <Text
                      style={[
                        styles.dayNumber,
                        !isCurrentMonth && styles.dayNumberOutside,
                        (isTodayDate || dayData) && styles.dayNumberActive,
                        dayData && colors && { color: colors.text },
                      ]}
                    >
                      {date.getDate()}
                    </Text>
                    {dayData && dayData.workouts.length > 0 && (
                      <View style={styles.workoutBadgeContainer}>
                        {dayData.workouts.slice(0, 2).map((workout) => (
                          <Text
                            key={workout.workout_id}
                            style={[styles.workoutTypeLabel, colors && { color: colors.text }]}
                            numberOfLines={1}
                          >
                            {workout.type ?? 'Session'}
                          </Text>
                        ))}
                        {dayData.workouts.length > 2 && (
                          <Text style={[styles.workoutTypeLabel, colors && { color: colors.text }]}>+
                            {dayData.workouts.length - 2}
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
  errorBanner: {
    backgroundColor: '#3b1f1f',
    padding: 10,
    borderRadius: 12,
    marginBottom: 12,
  },
  errorText: {
    color: '#ffb4b4',
    fontSize: 13,
  },
  weekdayRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 16,
    paddingHorizontal: 2,
  },
  weekdayCell: {
    width: DAY_COLUMN_PERCENT,
    alignItems: 'center',
    paddingVertical: 6,
    borderRadius: 10,
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
  },
  weekdayText: {
    fontSize: 12,
    fontWeight: '700' as const,
    color: Colors.textSecondary,
    letterSpacing: 0.5,
  },
  daysGrid: {
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.04)',
    paddingTop: 12,
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  dayCell: {
    width: DAY_COLUMN_PERCENT,
    maxWidth: DAY_COLUMN_PERCENT,
    marginBottom: 12,
  },
  dayInner: {
    width: '100%',
    aspectRatio: 1,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 6,
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
  daySelected: {
    borderWidth: 2,
    borderColor: Colors.primary,
  },
  workoutBadgeContainer: {
    alignItems: 'center',
    marginTop: 4,
  },
  workoutTypeLabel: {
    fontSize: 9,
    fontWeight: '600' as const,
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
