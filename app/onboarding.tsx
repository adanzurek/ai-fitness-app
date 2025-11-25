import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { Stack, useRouter } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CheckCircle2, Circle } from "lucide-react-native";
import Colors from "@/constants/colors";
import { useSupabaseUser } from "@/hooks/useSupabaseUser";
import { useFitness } from "@/contexts/FitnessContext";
import { supabase, isSupabaseConfigured } from "@/lib/supabase";
import type { FitnessGoalType, FitnessLevel, Profile, WeekdayName } from "@/types/supabase";
import {
  fitnessLevelOptions,
  goalOptions,
  weekdayOptions,
  sortWeekdays,
  defaultWeekdaysByCount,
} from "@/constants/profilePreferences";

const formatLocalISODate = (date: Date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

export default function OnboardingScreen() {
  const router = useRouter();
  const { user, loading } = useSupabaseUser();
  const { updateUserProfile, userProfile } = useFitness();
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();
  const [selectedLevel, setSelectedLevel] = useState<FitnessLevel | null>(null);
  const [selectedWeekdays, setSelectedWeekdays] = useState<WeekdayName[]>([]);
  const [selectedGoal, setSelectedGoal] = useState<FitnessGoalType | null>(null);
  const [customGoal, setCustomGoal] = useState<string>("");
  const [hasPrefilled, setHasPrefilled] = useState<boolean>(false);
  const [hasAlertedProfileError, setHasAlertedProfileError] = useState<boolean>(false);
  const [isFinalizingPlan, setIsFinalizingPlan] = useState<boolean>(false);
  const selectedDayCount = selectedWeekdays.length;

  const profileQuery = useQuery<Profile | null>({
    queryKey: ["profile", user?.id ?? null],
    enabled: Boolean(user) && isSupabaseConfigured,
    staleTime: 5 * 60 * 1000,
    queryFn: async ({ queryKey }) => {
      const [, userId] = queryKey as [string, string | null];
      if (!userId) {
        console.log("Onboarding profile query skipped: no user");
        return null;
      }

      console.log("Onboarding fetching profile for user", userId);
      const { data, error } = await supabase
        .from("profiles")
        .select("id, full_name, goals, experience_level, schedule, equipment, plan")
        .eq("id", userId)
        .maybeSingle();

      if (error) {
        console.error("Onboarding profile query error", error);
        throw error;
      }

      return (data as Profile | null) ?? null;
    },
  });

  useEffect(() => {
    if (!loading && !user) {
      console.log('Onboarding no user detected, navigating to signin');
      router.replace('/signin');
    }
  }, [loading, user, router]);

  useEffect(() => {
    const profile = profileQuery.data;
    if (profile && !hasPrefilled) {
      setSelectedLevel((profile.experience_level as FitnessLevel | null) ?? null);
      const scheduleNames = Array.isArray(profile.schedule?.training_day_names)
        ? sortWeekdays(profile.schedule.training_day_names)
        : [];
      const scheduleDays = typeof profile.schedule?.training_days_per_week === "number"
        ? profile.schedule.training_days_per_week
        : null;
      setSelectedWeekdays(scheduleNames.length > 0 ? scheduleNames : defaultWeekdaysByCount(scheduleDays));
      const goalMatch = goalOptions.find((option) => option.label === profile.goals);
      if (goalMatch) {
        setSelectedGoal(goalMatch.value);
        setCustomGoal(goalMatch.value === 'custom' ? profile.goals ?? "" : "");
      } else if (typeof profile.goals === 'string' && profile.goals.length > 0) {
        setSelectedGoal('custom');
        setCustomGoal(profile.goals);
      } else {
        setSelectedGoal(null);
        setCustomGoal("");
      }
      setHasPrefilled(true);
    }
  }, [profileQuery.data, hasPrefilled]);

  useEffect(() => {
    if (profileQuery.isError && !hasAlertedProfileError) {
      const message = profileQuery.error instanceof Error ? profileQuery.error.message : 'Unable to load profile details. Please try again later.';
      Alert.alert('Onboarding', message);
      setHasAlertedProfileError(true);
    }
  }, [profileQuery.isError, profileQuery.error, hasAlertedProfileError]);

  const canSubmit = useMemo(() => {
    if (!selectedLevel || selectedDayCount === 0 || !selectedGoal) {
      return false;
    }
    if (selectedGoal === "custom" && customGoal.trim().length === 0) {
      return false;
    }
    return true;
  }, [selectedGoal, selectedDayCount, selectedLevel, customGoal]);

  const finalizePlan = useCallback(async () => {
    if (!user?.id || !isSupabaseConfigured) {
      return;
    }
    const todayISO = formatLocalISODate(new Date());
    const preferredDays = selectedWeekdays.map((d) => d.toLowerCase() as WeekdayName);
    const trainingDaysCount =
      preferredDays.length > 0
        ? preferredDays.length
        : Math.max(1, selectedWeekdays.length || 3);
    try {
      setIsFinalizingPlan(true);
      const { error: planError } = await supabase.functions.invoke("generate_plan_ai", {
        body: {
          user_id: user.id,
          start_date: todayISO,
          training_days: trainingDaysCount,
          training_day_names: preferredDays,
        },
      });
      if (planError) {
        console.error("[Onboarding] generate_plan_ai error", planError);
        Alert.alert(
          "Plan setup incomplete",
          "We couldn’t generate your full program yet, but you can regenerate it from Settings later."
        );
        return;
      }
      const weekRequest: Record<string, unknown> = {
        start_date: todayISO,
        training_days_per_week: trainingDaysCount,
        training_day_names: preferredDays,
      };
      const { error: weekError } = await supabase.functions.invoke("generate_week", {
        body: weekRequest,
      });
      if (weekError) {
        console.error("[Onboarding] generate_week error", weekError);
        Alert.alert(
          "Week generation failed",
          "Program created, but we couldn’t refresh this week. Refresh the Home screen later to retry."
        );
      } else {
        await queryClient.invalidateQueries({ queryKey: ["month_calendar"], exact: false }).catch(() => undefined);
      }
    } catch (error) {
      console.error("[Onboarding] finalize plan unexpected error", error);
    } finally {
      setIsFinalizingPlan(false);
    }
  }, [queryClient, selectedWeekdays, user]);

  const mutation = useMutation({
    mutationFn: async () => {
      if (!user) {
        throw new Error('Missing authenticated user');
      }

      if (!isSupabaseConfigured) {
        throw new Error('Supabase environment not configured');
      }

      const trimmedCustom = customGoal.trim();
      const resolvedGoal = selectedGoal === 'custom'
        ? trimmedCustom
        : goalOptions.find((option) => option.value === selectedGoal)?.label ?? selectedGoal ?? null;

      const payload: Partial<Profile> & { id: string } = {
        id: user.id,
        full_name: typeof user.user_metadata?.full_name === 'string' ? user.user_metadata.full_name : user.email ?? null,
        experience_level: selectedLevel,
        goals: resolvedGoal,
        schedule: selectedDayCount
          ? { training_days_per_week: selectedDayCount, training_day_names: selectedWeekdays }
          : null,
        equipment: null,
        plan: null,
      };

      console.log('Onboarding submitting profile payload', payload);
      const { data, error } = await supabase.from('profiles').upsert(payload, { onConflict: 'id' }).select('id, full_name, goals, experience_level, schedule, equipment, plan').maybeSingle();
      if (error) {
        console.error('Onboarding upsert error', error);
        throw error;
      }

      return data as Profile | null;
    },
    onSuccess: async (data) => {
      if (user) {
        await queryClient.invalidateQueries({ queryKey: ["profile", user.id] });
      }
      const primaryGoalType = selectedGoal;
      const nextProfile = {
        ...userProfile,
        fitnessLevel: selectedLevel,
        trainingDaysPerWeek: selectedDayCount,
        preferredTrainingDays: selectedWeekdays,
        primaryGoalType,
        primaryGoalCustom: primaryGoalType === 'custom' ? customGoal.trim() || null : null,
      };
      updateUserProfile(nextProfile);
      console.log('Onboarding upsert success, generating plan...');
      await finalizePlan();
      router.replace('/(tabs)');
    },
    onError: (error: unknown) => {
      const message = error instanceof Error ? error.message : 'Unable to complete onboarding. Please try again.';
      Alert.alert('Onboarding', message);
    },
  });

  const handleSelectLevel = (value: FitnessLevel) => {
    console.log('Onboarding select level', value);
    setSelectedLevel(value);
  };

  const handleToggleWeekday = (value: WeekdayName) => {
    console.log("Onboarding toggle training day", value);
    setSelectedWeekdays((prev) => {
      const exists = prev.includes(value);
      const next = exists ? prev.filter((day) => day !== value) : [...prev, value];
      return sortWeekdays(next);
    });
  };

  const handleSelectGoal = (value: FitnessGoalType) => {
    console.log('Onboarding select goal', value);
    setSelectedGoal(value);
    if (value !== 'custom') {
      setCustomGoal('');
    }
  };

  const handleSubmit = () => {
    if (!canSubmit) {
      Alert.alert('Almost there', 'Please complete all selections to continue.');
      return;
    }
    console.log('Onboarding submit pressed');
    mutation.mutate();
  };

  const isSubmitting = mutation.isPending || isFinalizingPlan;
  const submitLabel = isFinalizingPlan
    ? "Setting up your program..."
    : mutation.isPending
      ? "Saving preferences..."
      : "Start Training";

  return (
    <LinearGradient
      colors={[Colors.background, '#120404']}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={styles.gradient}
    >
      <Stack.Screen options={{ headerShown: false }} />
      <View style={[styles.wrapper, { paddingTop: insets.top + 24, paddingBottom: insets.bottom + 32 }]}
        testID="onboarding-wrapper"
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.headerBlock}>
            <Text style={styles.eyebrow}>Welcome</Text>
            <Text style={styles.title}>Let&apos;s tailor Optimal for you</Text>
            <Text style={styles.subtitle}>Dial in your training experience so every session hits the mark.</Text>
          </View>

          <View style={styles.section} testID="onboarding-fitness-level">
            <Text style={styles.sectionLabel}>Fitness Level</Text>
            <View style={styles.cardGrid}>
              {fitnessLevelOptions.map((option) => {
                const selected = selectedLevel === option.value;
                return (
                  <Pressable
                    key={option.value}
                    style={({ pressed }) => [
                      styles.optionCard,
                      selected && styles.optionCardSelected,
                      pressed && styles.optionCardPressed,
                    ]}
                    onPress={() => handleSelectLevel(option.value)}
                    testID={`onboarding-level-${option.value}`}
                    accessibilityRole="button"
                    accessibilityLabel={`Select ${option.label} fitness level`}
                  >
                    <View style={styles.optionHeader}>
                      {selected ? (
                        <CheckCircle2 color={Colors.primary} size={22} />
                      ) : (
                        <Circle color={Colors.textSecondary} size={22} />
                      )}
                      <Text style={styles.optionTitle}>{option.label}</Text>
                    </View>
                    <Text style={styles.optionDescription}>{option.description}</Text>
                  </Pressable>
                );
              })}
            </View>
          </View>

          <View style={styles.section} testID="onboarding-training-days">
            <Text style={styles.sectionLabel}>Weekly Training Schedule</Text>
            <Text style={styles.sectionDescription}>
              Choose the exact days you prefer to train. We&apos;ll align your plan and calendar to these selections.
            </Text>
            <View style={styles.weekdayGrid}>
              {weekdayOptions.map((option) => {
                const selected = selectedWeekdays.includes(option.value);
                return (
                  <Pressable
                    key={option.value}
                    style={({ pressed }) => [
                      styles.weekdayChip,
                      selected && styles.weekdayChipSelected,
                      pressed && styles.weekdayChipPressed,
                    ]}
                    onPress={() => handleToggleWeekday(option.value)}
                    testID={`onboarding-day-${option.value}`}
                    accessibilityRole="button"
                    accessibilityLabel={`Train on ${option.label}`}
                  >
                    <Text style={styles.weekdayChipShort}>{option.shortLabel}</Text>
                    <Text style={styles.weekdayChipLabel}>{option.label}</Text>
                  </Pressable>
                );
              })}
            </View>
            <Text style={styles.weekdayHelper}>
              {selectedDayCount > 0
                ? `Training ${selectedDayCount} day${selectedDayCount > 1 ? "s" : ""} per week`
                : "Pick at least one day to continue"}
            </Text>
          </View>

          <View style={styles.section} testID="onboarding-goal">
            <Text style={styles.sectionLabel}>Primary Fitness Goal</Text>
            <View style={styles.cardStack}>
              {goalOptions.map((option) => {
                const selected = selectedGoal === option.value;
                return (
                  <Pressable
                    key={option.value}
                    style={({ pressed }) => [
                      styles.goalCard,
                      selected && styles.goalCardSelected,
                      pressed && styles.goalCardPressed,
                    ]}
                    onPress={() => handleSelectGoal(option.value)}
                    testID={`onboarding-goal-${option.value}`}
                    accessibilityRole="button"
                    accessibilityLabel={`Select ${option.label} goal`}
                  >
                    <View style={styles.optionHeader}>
                      {selected ? (
                        <CheckCircle2 color={Colors.primary} size={22} />
                      ) : (
                        <Circle color={Colors.textSecondary} size={22} />
                      )}
                      <Text style={styles.goalTitle}>{option.label}</Text>
                    </View>
                    <Text style={styles.goalDescription}>{option.blurb}</Text>
                  </Pressable>
                );
              })}
            </View>
            {selectedGoal === 'custom' && (
              <View style={styles.customGoalBox}>
                <Text style={styles.customGoalLabel}>Describe your custom goal</Text>
                <TextInput
                  style={styles.customGoalInput}
                  value={customGoal}
                  onChangeText={setCustomGoal}
                  placeholder="Crush a sub-20 5k while maintaining strength..."
                  placeholderTextColor={Colors.textMuted}
                  multiline
                  numberOfLines={4}
                  textAlignVertical="top"
                  returnKeyType={Platform.OS === 'ios' ? 'done' : 'default'}
                  testID="onboarding-custom-goal-input"
                />
              </View>
            )}
          </View>
        </ScrollView>

        <Pressable
          style={({ pressed }) => [
            styles.submitButton,
            (!canSubmit || isSubmitting) && styles.submitButtonDisabled,
            pressed && styles.submitButtonPressed,
          ]}
          onPress={handleSubmit}
          disabled={!canSubmit || isSubmitting}
          accessibilityRole="button"
          accessibilityLabel="Complete onboarding"
          testID="onboarding-submit"
        >
          {isSubmitting ? (
            <View style={styles.submitLoadingContent}>
              <ActivityIndicator color={Colors.text} style={{ marginRight: 8 }} />
              <Text style={styles.submitButtonText}>{submitLabel}</Text>
            </View>
          ) : (
            <Text style={styles.submitButtonText}>{submitLabel}</Text>
          )}
        </Pressable>
      </View>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  gradient: {
    flex: 1,
  },
  wrapper: {
    flex: 1,
    paddingHorizontal: 24,
    justifyContent: 'space-between',
  },
  scrollContent: {
    paddingBottom: 32,
    gap: 32,
  },
  headerBlock: {
    gap: 12,
  },
  eyebrow: {
    fontSize: 14,
    fontWeight: '600',
    letterSpacing: 2,
    textTransform: 'uppercase',
    color: Colors.textSecondary,
  },
  title: {
    fontSize: 32,
    fontWeight: '700',
    color: Colors.text,
    lineHeight: 38,
  },
  subtitle: {
    fontSize: 16,
    color: Colors.textSecondary,
    lineHeight: 22,
  },
  section: {
    gap: 16,
  },
  sectionLabel: {
    fontSize: 18,
    fontWeight: '700',
    color: Colors.text,
  },
  cardGrid: {
    flexDirection: 'column',
    gap: 16,
  },
  optionCard: {
    borderRadius: 20,
    padding: 20,
    backgroundColor: Colors.cardBackground,
    borderWidth: 1,
    borderColor: Colors.border,
    gap: 12,
  },
  optionCardSelected: {
    borderColor: Colors.primary,
    backgroundColor: '#1F0B0B',
  },
  optionCardPressed: {
    transform: [{ scale: 0.98 }],
  },
  optionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  optionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: Colors.text,
  },
  optionDescription: {
    fontSize: 14,
    color: Colors.textSecondary,
    lineHeight: 20,
  },
  sectionDescription: {
    fontSize: 14,
    color: Colors.textSecondary,
    lineHeight: 20,
  },
  weekdayGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
  },
  weekdayChip: {
    width: "30%",
    minWidth: 90,
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.cardBackground,
    alignItems: "flex-start",
    gap: 4,
  },
  weekdayChipSelected: {
    borderColor: Colors.primary,
    backgroundColor: "#1F0B0B",
  },
  weekdayChipPressed: {
    transform: [{ scale: 0.97 }],
  },
  weekdayChipShort: {
    fontSize: 13,
    color: Colors.textSecondary,
    fontWeight: "600",
  },
  weekdayChipLabel: {
    fontSize: 16,
    fontWeight: "700",
    color: Colors.text,
  },
  weekdayHelper: {
    marginTop: 8,
    fontSize: 13,
    color: Colors.textSecondary,
  },
  cardStack: {
    gap: 12,
  },
  goalCard: {
    borderRadius: 18,
    paddingVertical: 18,
    paddingHorizontal: 20,
    backgroundColor: Colors.cardBackground,
    borderWidth: 1,
    borderColor: Colors.border,
    gap: 10,
  },
  goalCardSelected: {
    borderColor: Colors.primary,
    backgroundColor: '#1F0B0B',
  },
  goalCardPressed: {
    transform: [{ scale: 0.98 }],
  },
  goalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: Colors.text,
  },
  goalDescription: {
    fontSize: 14,
    color: Colors.textSecondary,
    lineHeight: 20,
  },
  customGoalBox: {
    marginTop: 16,
    backgroundColor: Colors.cardBackground,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: 18,
    gap: 12,
  },
  customGoalLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.text,
  },
  customGoalInput: {
    minHeight: 96,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: 14,
    color: Colors.text,
    fontSize: 16,
    backgroundColor: '#0F0F0F',
  },
  submitButton: {
    borderRadius: 16,
    paddingVertical: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.primary,
  },
  submitButtonDisabled: {
    opacity: 0.5,
  },
  submitButtonPressed: {
    transform: [{ scale: 0.98 }],
  },
  submitButtonText: {
    fontSize: 18,
    fontWeight: '700',
    color: Colors.text,
  },
  submitLoadingContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
});
