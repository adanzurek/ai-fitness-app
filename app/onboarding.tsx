import { useEffect, useMemo, useState } from "react";
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
import { supabase, isSupabaseConfigured } from "@/lib/supabase";
import type { FitnessGoalType, FitnessLevel, Profile } from "@/types/supabase";
import { fitnessLevelOptions, goalOptions, trainingDayOptions } from "@/constants/profilePreferences";

export default function OnboardingScreen() {
  const router = useRouter();
  const { user, loading } = useSupabaseUser();
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();
  const [selectedLevel, setSelectedLevel] = useState<FitnessLevel | null>(null);
  const [selectedDays, setSelectedDays] = useState<number | null>(null);
  const [selectedGoal, setSelectedGoal] = useState<FitnessGoalType | null>(null);
  const [customGoal, setCustomGoal] = useState<string>("");
  const [hasPrefilled, setHasPrefilled] = useState<boolean>(false);
  const [hasAlertedProfileError, setHasAlertedProfileError] = useState<boolean>(false);

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
        .select("id, fitness_level, training_days_per_week, fitness_goal_type, fitness_goal_custom")
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
    if (profileQuery.data && !hasPrefilled) {
      setSelectedLevel(profileQuery.data.fitness_level ?? null);
      setSelectedDays(profileQuery.data.training_days_per_week ?? null);
      setSelectedGoal(profileQuery.data.fitness_goal_type ?? null);
      if (profileQuery.data.fitness_goal_type === 'custom') {
        setCustomGoal(profileQuery.data.fitness_goal_custom ?? "");
      } else {
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
    if (!selectedLevel || !selectedDays || !selectedGoal) {
      return false;
    }
    if (selectedGoal === "custom" && customGoal.trim().length === 0) {
      return false;
    }
    return true;
  }, [selectedGoal, selectedDays, selectedLevel, customGoal]);

  const mutation = useMutation({
    mutationFn: async () => {
      if (!user) {
        throw new Error('Missing authenticated user');
      }

      if (!isSupabaseConfigured) {
        throw new Error('Supabase environment not configured');
      }

      const payload: Partial<Profile> & { id: string } = {
        id: user.id,
        full_name: typeof user.user_metadata?.full_name === 'string' ? user.user_metadata.full_name : user.email ?? null,
        fitness_level: selectedLevel,
        training_days_per_week: selectedDays,
        fitness_goal_type: selectedGoal,
        fitness_goal_custom: selectedGoal === 'custom' ? customGoal.trim() : null,
      };

      console.log('Onboarding submitting profile payload', payload);
      const { error } = await supabase.from('profiles').upsert(payload, { onConflict: 'id' });
      if (error) {
        console.error('Onboarding upsert error', error);
        throw error;
      }

      return payload;
    },
    onSuccess: async (_data, _variables, _context) => {
      if (user) {
        await queryClient.invalidateQueries({ queryKey: ["profile", user.id] });
      }
      console.log('Onboarding upsert success directing to tabs');
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

  const handleSelectDays = (value: number) => {
    console.log('Onboarding select training days', value);
    setSelectedDays(value);
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
            <Text style={styles.sectionLabel}>Training Days per Week</Text>
            <View style={styles.trainingRow}>
              {trainingDayOptions.map((day) => {
                const selected = selectedDays === day;
                return (
                  <Pressable
                    key={day}
                    style={({ pressed }) => [
                      styles.dayChip,
                      selected && styles.dayChipSelected,
                      pressed && styles.dayChipPressed,
                    ]}
                    onPress={() => handleSelectDays(day)}
                    testID={`onboarding-days-${day}`}
                    accessibilityRole="button"
                    accessibilityLabel={`Train ${day} days per week`}
                  >
                    <Text style={styles.dayChipText}>{day}</Text>
                  </Pressable>
                );
              })}
            </View>
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
            (!canSubmit || mutation.isPending) && styles.submitButtonDisabled,
            pressed && styles.submitButtonPressed,
          ]}
          onPress={handleSubmit}
          disabled={!canSubmit || mutation.isPending}
          accessibilityRole="button"
          accessibilityLabel="Complete onboarding"
          testID="onboarding-submit"
        >
          {mutation.isPending ? (
            <ActivityIndicator color={Colors.text} />
          ) : (
            <Text style={styles.submitButtonText}>Start Training</Text>
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
  trainingRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  dayChip: {
    minWidth: 56,
    paddingVertical: 12,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.cardBackground,
    alignItems: 'center',
  },
  dayChipSelected: {
    borderColor: Colors.primary,
    backgroundColor: '#1F0B0B',
  },
  dayChipPressed: {
    transform: [{ scale: 0.95 }],
  },
  dayChipText: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.text,
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
});
