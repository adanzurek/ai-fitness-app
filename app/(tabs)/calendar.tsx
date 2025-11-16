import {
  StyleSheet,
  Text,
  View,
  ScrollView,
  TouchableOpacity,
  Platform,
  Alert,
  ActivityIndicator,
} from "react-native";
import Colors from "@/constants/colors";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import MonthlyCalendar from "@/components/MonthlyCalendar";
import { useMonthlyWorkouts } from "@/hooks/useMonthlyWorkouts";
import { useSupabaseUser } from "@/hooks/useSupabaseUser";
import { useRouter } from "expo-router";
import { supabase, isSupabaseConfigured } from "@/lib/supabase";

type ComposeTodaySet = {
  id: string;
  name: string;
  sets?: number | null;
  reps?: number | null;
  rir?: number | null;
  weight?: number | null;
};

type ComposeTodayWorkout = {
  id?: string;
  label?: string | null;
  type?: string | null;
  notes?: string | null;
  workout_date: string;
  sets?: ComposeTodaySet[] | null;
};

type ComposeTodayResponse = {
  ok?: boolean;
  workout?: ComposeTodayWorkout | null;
  workout_id?: string | null;
};

function formatLocalISO(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export default function CalendarScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { user } = useSupabaseUser();
  const staticToday = useMemo(() => new Date(2025, 10, 15), []);
  const [currentDate, setCurrentDate] = useState(() => {
    return new Date(2025, 10, 1);
  });
  const [selectedDate, setSelectedDate] = useState(() => formatLocalISO(staticToday));
  const [isComposing, setIsComposing] = useState(false);
  const [dayError, setDayError] = useState<string | null>(null);

  const currentYear = currentDate.getFullYear();
  const currentMonth = currentDate.getMonth();

  const { days, loading, error } = useMonthlyWorkouts({ year: currentYear, month: currentMonth });

  useEffect(() => {
    if (
      currentYear === staticToday.getFullYear() &&
      currentMonth === staticToday.getMonth()
    ) {
      setSelectedDate(formatLocalISO(staticToday));
      return;
    }
    setSelectedDate(formatLocalISO(new Date(currentYear, currentMonth, 1)));
  }, [currentYear, currentMonth, staticToday]);

  const handleSelectDate = useCallback(
    async (dateISO: string) => {
      setSelectedDate(dateISO);
      if (!isSupabaseConfigured) {
        Alert.alert("Supabase not configured", "Configure Supabase to load workouts for selected dates.");
        return;
      }
      if (!user?.id) {
        Alert.alert("No user", "Please sign in to view workout details.");
        return;
      }
      try {
        setDayError(null);
        setIsComposing(true);
        console.log("[Calendar] compose_today invoked", { dateISO, user: user.id });
        const { data, error: fnError } = await supabase.functions.invoke<ComposeTodayResponse>("compose_today", {
          body: { user_id: user.id, date: dateISO },
        });
        console.log("[Calendar] compose_today response", data);
        console.error("[Calendar] compose_today error", fnError);
        if (fnError) {
          throw fnError;
        }
        const noWorkout = !data || data.ok === false || !data.workout;
        if (noWorkout) {
          router.push({
            pathname: "/day-view",
            params: {
              date: dateISO,
              isRest: "true",
            },
          });
          return;
        }
        const workoutDate = data.workout?.workout_date ?? dateISO;
        const workoutId = data.workout_id ?? data.workout?.id ?? "";
        const workoutType = data.workout?.type ?? data.workout?.label ?? "Session";
        const workoutNotes = data.workout?.notes ?? "";
        const workoutSets = JSON.stringify(data.workout?.sets ?? []);
        router.push({
          pathname: "/day-view",
          params: {
            date: workoutDate,
            workoutId,
            type: workoutType,
            notes: workoutNotes,
            sets: workoutSets,
          },
        });
      } catch (err) {
        console.error("[Calendar] Unable to load day", err);
        setDayError("We couldn\'t load this day. Please try again.");
        Alert.alert("Something went wrong", "Unable to load details for this day. Try again in a moment.");
      } finally {
        setIsComposing(false);
      }
    },
    [router, user]
  );

  const changeMonth = (delta: number) => {
    setCurrentDate((prev) => {
      const next = new Date(prev);
      next.setMonth(prev.getMonth() + delta);
      return next;
    });
  };

  return (
    <View style={styles.container} testID="calendar-screen">
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
          <TouchableOpacity style={styles.monthNavButton} onPress={() => changeMonth(-1)} testID="calendar-prev-month">
            <Text style={styles.monthNavText}>Prev</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.monthNavButton} onPress={() => changeMonth(1)} testID="calendar-next-month">
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
          todayOverride={staticToday}
          selectedDate={selectedDate}
        />

        <View style={styles.instructionsCard}>
          <Text style={styles.instructionsTitle}>Select a date</Text>
          <Text style={styles.instructionsText}>
            Tap any day to load its workout details. You can mark exercises complete from the day view.
          </Text>
          {dayError ? <Text style={styles.errorTextInline}>{dayError}</Text> : null}
        </View>
      </ScrollView>

      {isComposing && (
        <View style={styles.loadingOverlay} pointerEvents="none">
          <ActivityIndicator size="large" color={Colors.primary}
            testID="calendar-compose-loading"
          />
        </View>
      )}
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
  instructionsCard: {
    backgroundColor: Colors.cardBackground,
    padding: 24,
    borderRadius: 24,
    marginTop: 20,
    gap: 12,
  },
  instructionsTitle: {
    fontSize: 18,
    fontWeight: "700" as const,
    color: Colors.text,
  },
  instructionsText: {
    fontSize: 14,
    color: Colors.textSecondary,
    lineHeight: 20,
  },
  errorTextInline: {
    fontSize: 13,
    color: "#FCA5A5",
  },
  loadingOverlay: {
    position: "absolute",
    bottom: 40,
    left: 0,
    right: 0,
    alignItems: "center",
    justifyContent: "center",
  },
});
