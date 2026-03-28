import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  InteractionManager,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useRouter } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import { Image } from "expo-image";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { LogOut, ArrowLeft, User as UserIcon, ChevronDown, ChevronUp, Check } from "lucide-react-native";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Colors from "@/constants/colors";
import { useSupabaseUser } from "@/hooks/useSupabaseUser";
import { useFitness } from "@/contexts/FitnessContext";
import { supabase, isSupabaseConfigured } from "@/lib/supabase";
import { setSkipAuth } from "@/lib/authSkip";
import {
  fitnessLevelOptions,
  goalOptions,
  weekdayOptions,
  sortWeekdays,
  defaultWeekdaysByCount,
} from "@/constants/profilePreferences";
import type { FitnessGoalType, FitnessLevel, Profile, WeekdayName } from "@/types/supabase";

type PreferenceField = "level" | "days" | "goal" | null;

const formatLocalISODate = (date: Date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

type PreferenceState = {
  level: FitnessLevel | null;
  dayNames: WeekdayName[];
  goalType: FitnessGoalType | null;
  goalCustom: string;
};

type PreferenceMutationResult = {
  payload: Profile | null;
  state: PreferenceState;
};

export default function ProfileScreen() {
  const router = useRouter();
  const { user } = useSupabaseUser();
  const { userProfile, updateUserProfile } = useFitness();
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();
  const [signingOut, setSigningOut] = useState<boolean>(false);
  const [activeField, setActiveField] = useState<PreferenceField>(null);
  const [selectedLevel, setSelectedLevel] = useState<FitnessLevel | null>(null);
  const [selectedDayNames, setSelectedDayNames] = useState<WeekdayName[]>([]);
  const [selectedGoal, setSelectedGoal] = useState<FitnessGoalType | null>(null);
  const [customGoal, setCustomGoal] = useState<string>("");
  const [goalDraft, setGoalDraft] = useState<string>("");
  const [hasInitializedPreferences, setHasInitializedPreferences] = useState<boolean>(false);
  const [regeneratingPlan, setRegeneratingPlan] = useState(false);
  const regenTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const preferenceSaveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const trainingDayCount = selectedDayNames.length;

  const profileQuery = useQuery<Profile | null>({
    queryKey: ["profile", user?.id ?? null],
    enabled: Boolean(user) && isSupabaseConfigured,
    staleTime: 5 * 60 * 1000,
    queryFn: async ({ queryKey }) => {
      const [, userId] = queryKey as [string, string | null];
      if (!userId) {
        console.log("Profile preferences query skipped: no user");
        return null;
      }
      console.log("Profile fetching preferences for user", userId);
      const { data, error } = await supabase
        .from("profiles")
        .select("id, full_name, goals, experience_level, schedule, equipment, plan")
        .eq("id", userId)
        .maybeSingle();
      if (error) {
        console.error("Profile preferences query error", error);
        throw error;
      }
      return (data as Profile | null) ?? null;
    },
  });

  const applySupabaseProfile = useCallback((profile: Profile) => {
    const level = (profile.experience_level as FitnessLevel | null) ?? null;
    const weekdayNames = Array.isArray(profile.schedule?.training_day_names)
      ? sortWeekdays(profile.schedule.training_day_names)
      : [];
    const days = typeof profile.schedule?.training_days_per_week === "number"
      ? profile.schedule.training_days_per_week
      : null;
    const goalString = typeof profile.goals === "string" ? profile.goals : null;
    const goalMatch = goalOptions.find((option) => option.label === goalString);
    if (goalMatch) {
      setSelectedGoal(goalMatch.value);
      if (goalMatch.value === "custom") {
        const resolved = goalString ?? "";
        setCustomGoal(resolved);
        setGoalDraft(resolved);
      } else {
        setCustomGoal("");
        setGoalDraft("");
      }
    } else if (goalString && goalString.length > 0) {
      setSelectedGoal("custom");
      setCustomGoal(goalString);
      setGoalDraft(goalString);
    } else {
      setSelectedGoal(null);
      setCustomGoal("");
      setGoalDraft("");
    }
    setSelectedLevel(level);
    setSelectedDayNames(weekdayNames.length > 0 ? weekdayNames : defaultWeekdaysByCount(days));
  }, []);

  const initializeFromContext = useCallback(() => {
    const level = userProfile.fitnessLevel;
    const days = userProfile.trainingDaysPerWeek;
    const preferredDays = userProfile.preferredTrainingDays ?? [];
    const goalType = userProfile.primaryGoalType;
    const custom = goalType === "custom" ? userProfile.primaryGoalCustom ?? "" : "";
    setSelectedLevel(level);
    setSelectedDayNames(preferredDays.length > 0 ? sortWeekdays(preferredDays) : defaultWeekdaysByCount(days));
    setSelectedGoal(goalType);
    setCustomGoal(custom);
    setGoalDraft(custom);
  }, [userProfile]);

  useEffect(() => {
    if (profileQuery.data && !hasInitializedPreferences) {
      console.log("Profile applying supabase preferences");
      applySupabaseProfile(profileQuery.data);
      setHasInitializedPreferences(true);
      return;
    }
    if (!hasInitializedPreferences && (!isSupabaseConfigured || (profileQuery.isFetched && !profileQuery.data))) {
      console.log("Profile initializing preferences from context");
      initializeFromContext();
      setHasInitializedPreferences(true);
    }
  }, [profileQuery.data, profileQuery.isFetched, hasInitializedPreferences, applySupabaseProfile, initializeFromContext]);

  const regeneratePlan = useCallback(async () => {
    if (!user?.id || !isSupabaseConfigured) {
      return;
    }
    if (regeneratingPlan) {
      return;
    }
    const todayISO = formatLocalISODate(new Date());
    const preferredDays = selectedDayNames.map((d) => d.toLowerCase() as WeekdayName);
    const trainingDaysCount =
      preferredDays.length > 0
        ? preferredDays.length
        : typeof profileQuery.data?.schedule?.training_days_per_week === "number"
          ? profileQuery.data.schedule.training_days_per_week
          : Math.max(1, selectedDayNames.length || 3);
    try {
      setRegeneratingPlan(true);
      const { error: planError } = await supabase.functions.invoke("generate_plan_ai", {
        body: {
          user_id: user.id,
          start_date: todayISO,
          training_days: trainingDaysCount,
          training_day_names: preferredDays,
        },
      });
      if (planError) {
        console.error("[Profile] generate_plan_ai error", planError);
        Alert.alert(
          "Plan update incomplete",
          "We updated your preferences but couldn’t regenerate the program. Please try again later."
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
        console.error("[Profile] generate_week error", weekError);
        Alert.alert(
          "Week refresh failed",
          "Program updated, but we couldn’t refresh this week. Use the Home screen to refresh later."
        );
      } else {
        await queryClient.invalidateQueries({ queryKey: ["month_calendar"], exact: false }).catch(() => undefined);
      }
    } catch (err) {
      console.error("[Profile] regeneratePlan unexpected error", err);
    } finally {
      setRegeneratingPlan(false);
    }
  }, [queryClient, regeneratingPlan, selectedDayNames, user]);

  const queueRegeneratePlan = useCallback(() => {
    if (regenTimeoutRef.current) {
      clearTimeout(regenTimeoutRef.current);
    }
    regenTimeoutRef.current = setTimeout(() => {
      regenTimeoutRef.current = null;
      InteractionManager.runAfterInteractions(() => {
        regeneratePlan().catch(() => undefined);
      });
    }, 400);
  }, [regeneratePlan]);

  useEffect(() => {
    return () => {
      if (regenTimeoutRef.current) {
        clearTimeout(regenTimeoutRef.current);
      }
      if (preferenceSaveTimeoutRef.current) {
        clearTimeout(preferenceSaveTimeoutRef.current);
      }
    };
  }, []);

  const preferenceMutation = useMutation<PreferenceMutationResult, unknown, PreferenceState>({
    mutationFn: async (state) => {
      if (!user) {
        throw new Error("Missing authenticated user");
      }
      const sanitizedState: PreferenceState = {
        level: state.level,
        dayNames: sortWeekdays(state.dayNames),
        goalType: state.goalType,
        goalCustom: state.goalType === "custom" ? state.goalCustom.trim() : "",
      };
      if (!isSupabaseConfigured) {
        console.log("Profile storing preferences locally");
        return { payload: null, state: sanitizedState };
      }
      const goalValue = sanitizedState.goalType === "custom"
        ? sanitizedState.goalCustom
        : goalOptions.find((option) => option.value === sanitizedState.goalType)?.label ?? sanitizedState.goalType ?? null;
      const payload: Partial<Profile> & { id: string } = {
        id: user.id,
        experience_level: sanitizedState.level,
        goals: goalValue,
        schedule: sanitizedState.dayNames.length
          ? {
              training_days_per_week: sanitizedState.dayNames.length,
              training_day_names: sanitizedState.dayNames,
            }
          : null,
        equipment: null,
        plan: null,
      };
      console.log("Profile upserting preference payload", payload);
      const { data, error } = await supabase
        .from("profiles")
        .upsert(payload, { onConflict: "id" })
        .select("id, full_name, goals, experience_level, schedule, equipment, plan")
        .maybeSingle();
      if (error) {
        console.error("Profile preference upsert error", error);
        throw error;
      }
      return { payload: (data as Profile | null) ?? null, state: sanitizedState };
    },
    onSuccess: async (result) => {
      if (user && isSupabaseConfigured) {
        await queryClient.invalidateQueries({ queryKey: ["profile", user.id] });
      }
      const resolvedState = result.state;
      const trimmedCustom = resolvedState.goalType === "custom" ? resolvedState.goalCustom.trim() : "";
      const nextProfile = {
        ...userProfile,
        fitnessLevel: resolvedState.level,
        trainingDaysPerWeek: resolvedState.dayNames.length,
        preferredTrainingDays: resolvedState.dayNames,
        primaryGoalType: resolvedState.goalType,
        primaryGoalCustom: resolvedState.goalType === "custom" ? trimmedCustom || null : null,
      };
      updateUserProfile(nextProfile);
      setSelectedLevel(resolvedState.level);
      setSelectedDayNames(resolvedState.dayNames);
      setSelectedGoal(resolvedState.goalType);
      if (resolvedState.goalType === "custom") {
        setCustomGoal(trimmedCustom);
        setGoalDraft(trimmedCustom);
      } else {
        setCustomGoal("");
        setGoalDraft("");
      }
      console.log("Profile preferences updated", result.payload ? "profile synced" : "local only");
      queueRegeneratePlan();
    },
    onError: (error) => {
      console.error("Profile preferences update failed", error);
      const message = error instanceof Error ? error.message : "Unable to update preferences. Please try again.";
      Alert.alert("Profile", message);
    },
  });

  const toggleField = (field: PreferenceField) => {
    setActiveField((prev) => (prev === field ? null : field));
  };

  const submitPreferences = useCallback((state: PreferenceState) => {
    console.log("Profile submitting preferences", state);
    preferenceMutation.mutate(state);
  }, [preferenceMutation]);

  const submitPreferencesDebounced = useCallback((state: PreferenceState) => {
    if (preferenceSaveTimeoutRef.current) {
      clearTimeout(preferenceSaveTimeoutRef.current);
    }
    preferenceSaveTimeoutRef.current = setTimeout(() => {
      preferenceSaveTimeoutRef.current = null;
      InteractionManager.runAfterInteractions(() => submitPreferences(state));
    }, 220);
  }, [submitPreferences]);
  const preferencesBusy = preferenceMutation.isPending || regeneratingPlan;

  const handleSelectLevel = (value: FitnessLevel) => {
    if (selectedLevel === value) {
      toggleField(null);
      return;
    }
    toggleField(null);
    submitPreferences({
      level: value,
      dayNames: selectedDayNames,
      goalType: selectedGoal,
      goalCustom: selectedGoal === "custom" ? goalDraft : "",
    });
  };

  const handleToggleDayName = (value: WeekdayName) => {
    const exists = selectedDayNames.includes(value);
    const next = exists ? selectedDayNames.filter((day) => day !== value) : [...selectedDayNames, value];
    if (next.length === 0) {
      Alert.alert("Training days", "Select at least one training day.");
      return;
    }
    const sorted = sortWeekdays(next);
    setSelectedDayNames(sorted);
    submitPreferencesDebounced({
      level: selectedLevel,
      dayNames: sorted,
      goalType: selectedGoal,
      goalCustom: selectedGoal === "custom" ? goalDraft : "",
    });
  };

  const handleSelectGoal = (value: FitnessGoalType) => {
    setSelectedGoal(value);
    if (value === "custom") {
      toggleField("goal");
      const initialDraft = customGoal.length > 0 ? customGoal : goalDraft;
      setGoalDraft(initialDraft);
      return;
    }
    toggleField(null);
    submitPreferences({
      level: selectedLevel,
      dayNames: selectedDayNames,
      goalType: value,
      goalCustom: "",
    });
  };

  const handleSaveCustomGoal = () => {
    const trimmed = goalDraft.trim();
    if (trimmed.length === 0) {
      Alert.alert("Custom goal", "Add a description before saving.");
      return;
    }
    submitPreferences({
      level: selectedLevel,
      dayNames: selectedDayNames,
      goalType: "custom",
      goalCustom: trimmed,
    });
    toggleField(null);
  };

  const levelLabel = useMemo(() => {
    if (!selectedLevel) {
      return "Select level";
    }
    const match = fitnessLevelOptions.find((option) => option.value === selectedLevel);
    return match?.label ?? "Select level";
  }, [selectedLevel]);

  const daysLabel = useMemo(() => {
    if (!trainingDayCount) {
      return "Select days";
    }
    const shortLabels = selectedDayNames
      .map((value) => weekdayOptions.find((option) => option.value === value)?.shortLabel ?? value.slice(0, 3))
      .join(" · ");
    return `${shortLabels} (${trainingDayCount} day${trainingDayCount > 1 ? "s" : ""})`;
  }, [selectedDayNames, trainingDayCount]);

  const goalLabel = useMemo(() => {
    if (!selectedGoal) {
      return "Select goal";
    }
    if (selectedGoal === "custom") {
      return customGoal.length > 0 ? customGoal : "Custom goal";
    }
    const match = goalOptions.find((option) => option.value === selectedGoal);
    return match?.label ?? "Select goal";
  }, [selectedGoal, customGoal]);

  const preferencesLoading = !hasInitializedPreferences && profileQuery.isLoading;

  const avatarUrl = useMemo(() => {
    const metadataUrl = user?.user_metadata?.avatar_url;
    if (typeof metadataUrl === "string" && metadataUrl.length > 0) {
      return metadataUrl;
    }
    return null;
  }, [user]);

  const displayName = useMemo(() => {
    if (user?.user_metadata?.full_name) {
      return user.user_metadata.full_name as string;
    }
    if (user?.email) {
      return user.email;
    }
    return "Guest";
  }, [user]);

  useEffect(() => {
    console.log("Profile screen mounted");
  }, []);

  const handleBack = () => {
    console.log("Navigating back from profile");
    router.back();
  };

  const handleSignOut = async () => {
    if (signingOut) {
      return;
    }
    console.log("Attempting sign out");
    setSigningOut(true);
    try {
      if (user) {
        const { error } = await supabase.auth.signOut();
        if (error) {
          throw error;
        }
      }
      setSkipAuth(false);
      router.replace("/signin");
    } catch (error) {
      console.error("Sign out failed", error);
      const message =
        error instanceof Error ? error.message : "Unable to sign out. Please try again.";
      Alert.alert("Sign out", message);
    } finally {
      setSigningOut(false);
    }
  };

  const initials = useMemo(() => {
    if (!displayName) {
      return "?";
    }
    const parts = displayName.trim().split(" ");
    if (parts.length === 0) {
      return "?";
    }
    const [first, second] = parts;
    if (first && second) {
      return `${first[0]}${second[0]}`.toUpperCase();
    }
    return first[0]?.toUpperCase() ?? "?";
  }, [displayName]);

  return (
    <View style={[styles.container, { paddingTop: insets.top + 16, paddingBottom: insets.bottom + 24 }]}>
      <View style={styles.headerRow}>
        <Pressable
          onPress={handleBack}
          accessibilityRole="button"
          accessibilityLabel="Go back"
          style={({ pressed }) => [styles.backButton, pressed && styles.backButtonPressed]}
          testID="profile-back-button"
        >
          <ArrowLeft color={Colors.text} size={20} />
        </Pressable>
        <Text style={styles.headerTitle}>Profile</Text>
        <View style={styles.iconButtonPlaceholder} />
      </View>

      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        testID="profile-scroll"
      >
        <LinearGradient
          colors={[Colors.cardBackground, "#2B0D0D"]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.avatarWrapper}
        >
          <View style={styles.avatarCircle}>
            {avatarUrl ? (
              <Image
                source={{ uri: avatarUrl }}
                style={styles.avatarImage}
                contentFit="cover"
                transition={200}
              />
            ) : (
              <Text style={styles.avatarInitials}>{initials}</Text>
            )}
          </View>
          {!avatarUrl && (
            <View style={styles.avatarHint}>
              <UserIcon color={Colors.textSecondary} size={20} />
              <Text style={styles.avatarHintText}>Connect Google to sync your photo</Text>
            </View>
          )}
        </LinearGradient>

        <View style={styles.identityBlock}>
          <Text style={styles.nameText}>{displayName}</Text>
          <Text style={styles.emailText}>{user?.email ?? "Signed in as guest"}</Text>
          {user?.app_metadata?.provider ? (
            <Text style={styles.providerText}>
              Provider: {String(user.app_metadata.provider).toUpperCase()}
            </Text>
          ) : (
            <Text style={styles.providerText}>Provider: GUEST</Text>
          )}
        </View>

        <View
          style={[styles.section, styles.preferenceSection]}
          testID="profile-preferences-card"
        >
          <View style={styles.preferenceHeaderRow}>
            <Text style={styles.sectionTitle}>Training Preferences</Text>
            {preferencesBusy && (
              <View style={styles.savingBadge} testID="profile-preferences-saving">
                <ActivityIndicator size="small" color={Colors.text} />
                <Text style={styles.savingBadgeText}>Saving</Text>
              </View>
            )}
          </View>
          <Text style={styles.sectionBody}>
            Keep your plan dialed in. Update levels, volume, and goals anytime.
          </Text>
          {preferencesLoading ? (
            <View style={styles.preferenceLoading} testID="profile-preferences-loading">
              <ActivityIndicator color={Colors.primary} />
              <Text style={styles.preferenceLoadingText}>Loading preferences...</Text>
            </View>
          ) : (
            <View style={styles.preferenceList}>
              <View style={styles.preferenceCard}>
                <Pressable
                  onPress={() => toggleField("level")}
                  style={({ pressed }) => [
                    styles.preferencePressable,
                    pressed && styles.preferencePressablePressed,
                  ]}
                  accessibilityRole="button"
                  accessibilityLabel="Change experience level"
                  testID="profile-preference-level"
                >
                  <Text style={styles.preferenceLabel}>Experience level</Text>
                  <View style={styles.preferenceValueRow}>
                    <Text style={styles.preferenceValue}>{levelLabel}</Text>
                    {activeField === "level" ? (
                      <ChevronUp color={Colors.textSecondary} size={18} />
                    ) : (
                      <ChevronDown color={Colors.textSecondary} size={18} />
                    )}
                  </View>
                </Pressable>
                {activeField === "level" && (
                  <View style={styles.dropdown} testID="profile-level-dropdown">
                    {fitnessLevelOptions.map((option) => {
                      const isSelected = selectedLevel === option.value;
                      return (
                        <Pressable
                          key={option.value}
                          onPress={() => handleSelectLevel(option.value)}
                          style={({ pressed }) => [
                            styles.dropdownOption,
                            isSelected && styles.dropdownOptionSelected,
                            pressed && styles.dropdownOptionPressed,
                          ]}
                          accessibilityRole="button"
                          accessibilityLabel={`Set experience level to ${option.label}`}
                          testID={`profile-level-option-${option.value}`}
                        >
                          <View style={styles.dropdownOptionRow}>
                            <Text style={styles.dropdownOptionLabel}>{option.label}</Text>
                            {isSelected && <Check color={Colors.primary} size={18} />}
                          </View>
                          <Text style={styles.dropdownDescription}>{option.description}</Text>
                        </Pressable>
                      );
                    })}
                  </View>
                )}
              </View>

              <View style={styles.preferenceCard}>
                <Pressable
                  onPress={() => toggleField("days")}
                  style={({ pressed }) => [
                    styles.preferencePressable,
                    pressed && styles.preferencePressablePressed,
                  ]}
                  accessibilityRole="button"
                  accessibilityLabel="Change training days per week"
                  testID="profile-preference-days"
                >
                  <Text style={styles.preferenceLabel}>Training days per week</Text>
                  <View style={styles.preferenceValueRow}>
                    <Text style={styles.preferenceValue}>{daysLabel}</Text>
                    {activeField === "days" ? (
                      <ChevronUp color={Colors.textSecondary} size={18} />
                    ) : (
                      <ChevronDown color={Colors.textSecondary} size={18} />
                    )}
                  </View>
                </Pressable>
                {activeField === "days" && (
                  <View style={styles.dropdown} testID="profile-days-dropdown">
                    <View style={styles.weekdaySelectionHeader}>
                      <View>
                        <Text style={styles.daysHelperTitle}>Plan your week</Text>
                        <Text style={styles.daysHelperText}>Tap the days you plan to train.</Text>
                      </View>
                      <View
                        style={[
                          styles.dayCountBadge,
                          trainingDayCount >= 4 && styles.dayCountBadgeActive,
                        ]}
                      >
                        <Text style={styles.dayCountBadgeNumber}>{trainingDayCount}</Text>
                        <Text style={styles.dayCountBadgeLabel}>of 7</Text>
                      </View>
                    </View>
                    <View style={styles.weekdaySelectionGrid}>
                      {weekdayOptions.map((option) => {
                        const isSelected = selectedDayNames.includes(option.value);
                        return (
                          <Pressable
                            key={option.value}
                            onPress={() => handleToggleDayName(option.value)}
                            style={({ pressed }) => [
                              styles.weekdaySelectionChip,
                              isSelected && styles.weekdaySelectionChipSelected,
                              pressed && styles.weekdaySelectionChipPressed,
                            ]}
                            accessibilityRole="button"
                            accessibilityLabel={`Train on ${option.label}`}
                            testID={`profile-day-option-${option.value}`}
                          >
                            <LinearGradient
                              colors={isSelected ? ["#2D1A1A", "#120909"] : ["#161616", "#0F0F0F"]}
                              start={{ x: 0, y: 0 }}
                              end={{ x: 1, y: 1 }}
                              style={styles.weekdaySelectionChipInner}
                            >
                              <View style={styles.weekdaySelectionTopRow}>
                                <Text
                                  style={[
                                    styles.weekdaySelectionShort,
                                    isSelected && styles.weekdaySelectionShortSelected,
                                  ]}
                                  numberOfLines={1}
                                >
                                  {option.shortLabel}
                                </Text>
                                <View
                                  style={[
                                    styles.weekdaySelectionDot,
                                    isSelected && styles.weekdaySelectionDotActive,
                                  ]}
                                />
                              </View>
                              <Text
                                style={[
                                  styles.weekdaySelectionLabel,
                                  isSelected && styles.weekdaySelectionLabelSelected,
                                ]}
                                numberOfLines={1}
                                ellipsizeMode="tail"
                              >
                                {option.label}
                              </Text>
                            </LinearGradient>
                          </Pressable>
                        );
                      })}
                    </View>
                  </View>
                )}
              </View>

              <View style={styles.preferenceCard}>
                <Pressable
                  onPress={() => toggleField("goal")}
                  style={({ pressed }) => [
                    styles.preferencePressable,
                    pressed && styles.preferencePressablePressed,
                  ]}
                  accessibilityRole="button"
                  accessibilityLabel="Change primary goal"
                  testID="profile-preference-goal"
                >
                  <Text style={styles.preferenceLabel}>Primary goal</Text>
                  <View style={styles.preferenceValueRow}>
                    <Text style={styles.preferenceValue} numberOfLines={1}>
                      {goalLabel}
                    </Text>
                    {activeField === "goal" ? (
                      <ChevronUp color={Colors.textSecondary} size={18} />
                    ) : (
                      <ChevronDown color={Colors.textSecondary} size={18} />
                    )}
                  </View>
                </Pressable>
                {activeField === "goal" && (
                  <View style={styles.dropdown} testID="profile-goal-dropdown">
                    {goalOptions.map((option) => {
                      const isSelected = selectedGoal === option.value;
                      return (
                        <Pressable
                          key={option.value}
                          onPress={() => handleSelectGoal(option.value)}
                          style={({ pressed }) => [
                            styles.dropdownOption,
                            isSelected && styles.dropdownOptionSelected,
                            pressed && styles.dropdownOptionPressed,
                          ]}
                          accessibilityRole="button"
                          accessibilityLabel={`Set goal to ${option.label}`}
                          testID={`profile-goal-option-${option.value}`}
                        >
                          <View style={styles.dropdownOptionRow}>
                            <Text style={styles.dropdownOptionLabel}>{option.label}</Text>
                            {isSelected && <Check color={Colors.primary} size={18} />}
                          </View>
                          <Text style={styles.dropdownDescription}>{option.blurb}</Text>
                        </Pressable>
                      );
                    })}
                    {selectedGoal === "custom" && (
                      <View style={styles.customGoalEditor} testID="profile-custom-goal-editor">
                        <Text style={styles.customGoalLabel}>Custom goal</Text>
                        <TextInput
                          style={styles.customGoalInput}
                          value={goalDraft}
                          onChangeText={setGoalDraft}
                          multiline
                          placeholder="Describe what you're training for..."
                          placeholderTextColor={Colors.textMuted}
                          testID="profile-custom-goal-input"
                        />
                        <Pressable
                          onPress={handleSaveCustomGoal}
                          disabled={preferencesBusy || goalDraft.trim().length === 0}
                          style={({ pressed }) => [
                            styles.saveButton,
                            (preferencesBusy || goalDraft.trim().length === 0) && styles.saveButtonDisabled,
                            pressed && !(preferencesBusy || goalDraft.trim().length === 0) && styles.saveButtonPressed,
                          ]}
                          accessibilityRole="button"
                          accessibilityLabel="Save custom goal"
                          testID="profile-custom-goal-save"
                        >
                          {preferencesBusy ? (
                            <ActivityIndicator color={Colors.text} />
                          ) : (
                            <Text style={styles.saveButtonText}>Save goal</Text>
                          )}
                        </Pressable>
                      </View>
                    )}
                  </View>
                )}
              </View>
            </View>
          )}
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Account</Text>
          <Pressable
            onPress={handleSignOut}
            disabled={signingOut}
            accessibilityRole="button"
            accessibilityLabel="Sign out"
            style={({ pressed }) => [
              styles.signOutButton,
              pressed && styles.signOutButtonPressed,
              signingOut && styles.signOutButtonDisabled,
            ]}
            testID="sign-out-button"
          >
            {signingOut ? (
              <ActivityIndicator color={Colors.text} />
            ) : (
              <View style={styles.signOutContent}>
                <LogOut color={Colors.text} size={20} />
                <Text style={styles.signOutText}>Sign out</Text>
              </View>
            )}
          </Pressable>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Profile Sync</Text>
          <Text style={styles.sectionBody}>
            Your profile picture will sync with your Google account once you connect. For now we display a
            default badge.
          </Text>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
    paddingHorizontal: 24,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 32,
  },
  backButton: {
    width: 46,
    height: 46,
    borderRadius: 23,
    borderWidth: 1,
    borderColor: Colors.border,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: Colors.cardBackground,
    transform: [{ scale: 1 }],
  },
  backButtonPressed: {
    backgroundColor: "#141414",
    transform: [{ scale: 0.95 }],
  },
  iconButtonPlaceholder: {
    width: 46,
    height: 46,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: "700" as const,
    color: Colors.text,
  },
  content: {
    paddingBottom: 48,
    gap: 32,
  },
  avatarWrapper: {
    borderRadius: 28,
    padding: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarCircle: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: Colors.cardBackground,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: Colors.border,
    overflow: "hidden",
  },
  avatarImage: {
    width: 120,
    height: 120,
  },
  avatarInitials: {
    fontSize: 36,
    fontWeight: "700" as const,
    color: Colors.text,
  },
  avatarHint: {
    marginTop: 16,
    alignItems: "center",
    gap: 6,
  },
  avatarHintText: {
    fontSize: 12,
    color: Colors.textSecondary,
  },
  identityBlock: {
    alignItems: "center",
    gap: 8,
  },
  nameText: {
    fontSize: 24,
    fontWeight: "700" as const,
    color: Colors.text,
  },
  emailText: {
    fontSize: 14,
    color: Colors.textSecondary,
  },
  providerText: {
    fontSize: 12,
    color: Colors.textMuted,
  },
  section: {
    backgroundColor: Colors.cardBackground,
    borderRadius: 24,
    padding: 24,
    gap: 16,
    borderWidth: 1,
    borderColor: Colors.border,
    shadowColor: "#000000",
    shadowOpacity: Platform.OS === "ios" ? 0.2 : 0.25,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 8 },
    elevation: 8,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "600" as const,
    color: Colors.text,
  },
  sectionBody: {
    fontSize: 14,
    lineHeight: 20,
    color: Colors.textSecondary,
  },
  signOutButton: {
    borderRadius: 20,
    backgroundColor: Colors.primary,
    paddingVertical: 14,
    paddingHorizontal: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  signOutButtonPressed: {
    backgroundColor: Colors.primaryDark,
  },
  signOutButtonDisabled: {
    opacity: 0.6,
  },
  signOutContent: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  signOutText: {
    fontSize: 16,
    fontWeight: "600" as const,
    color: Colors.text,
  },
  preferenceSection: {
    gap: 24,
  },
  preferenceHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  savingBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: "#1F0B0B",
  },
  savingBadgeText: {
    fontSize: 12,
    fontWeight: "600" as const,
    color: Colors.text,
  },
  preferenceLoading: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 12,
  },
  preferenceLoadingText: {
    fontSize: 14,
    color: Colors.textSecondary,
  },
  preferenceList: {
    gap: 18,
  },
  preferenceCard: {
    borderRadius: 20,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: "#141414",
    overflow: "hidden",
  },
  preferencePressable: {
    paddingVertical: 18,
    paddingHorizontal: 20,
    gap: 12,
    backgroundColor: "#141414",
  },
  preferencePressablePressed: {
    backgroundColor: "#1B1B1B",
  },
  preferenceLabel: {
    fontSize: 14,
    fontWeight: "600" as const,
    color: Colors.textSecondary,
    textTransform: "uppercase",
    letterSpacing: 1,
  },
  preferenceValueRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  preferenceValue: {
    fontSize: 18,
    fontWeight: "700" as const,
    color: Colors.text,
    flexShrink: 1,
  },
  dropdown: {
    paddingHorizontal: 20,
    paddingBottom: 20,
    gap: 12,
    backgroundColor: "#101010",
    borderTopWidth: 1,
    borderColor: Colors.border,
  },
  dropdownOption: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: "#161616",
    paddingVertical: 14,
    paddingHorizontal: 16,
    gap: 8,
  },
  dropdownOptionSelected: {
    borderColor: Colors.primary,
    backgroundColor: "#1F0B0B",
  },
  dropdownOptionPressed: {
    backgroundColor: "#1C1C1C",
  },
  dropdownOptionRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  dropdownOptionLabel: {
    fontSize: 16,
    fontWeight: "600" as const,
    color: Colors.text,
  },
  dropdownDescription: {
    fontSize: 12,
    lineHeight: 18,
    color: Colors.textSecondary,
  },
  weekdaySelectionHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 12,
    marginTop: 4,
  },
  daysHelperTitle: {
    fontSize: 15,
    fontWeight: "700" as const,
    color: Colors.text,
    letterSpacing: 0.3,
  },
  weekdaySelectionGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    gap: 12,
    marginTop: 10,
  },
  weekdaySelectionChip: {
    width: "30%",
    minWidth: 104,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: "#121212",
    overflow: "hidden",
  },
  weekdaySelectionChipInner: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 12,
    gap: 8,
    borderRadius: 15,
  },
  weekdaySelectionChipSelected: {
    borderColor: Colors.primary,
    shadowColor: Colors.primary,
    shadowOpacity: 0.18,
    shadowRadius: 5,
    shadowOffset: { width: 0, height: 3 },
    elevation: 2,
  },
  weekdaySelectionChipPressed: {
    transform: [{ scale: 0.985 }],
  },
  weekdaySelectionTopRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  weekdaySelectionShort: {
    fontSize: 12,
    color: Colors.textSecondary,
    fontWeight: "600" as const,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  weekdaySelectionShortSelected: {
    color: Colors.text,
  },
  weekdaySelectionLabel: {
    fontSize: 15,
    fontWeight: "700" as const,
    color: Colors.text,
    flexShrink: 1,
    lineHeight: 20,
    letterSpacing: 0.2,
  },
  weekdaySelectionLabelSelected: {
    color: Colors.text,
  },
  weekdaySelectionDot: {
    width: 10,
    height: 10,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: "transparent",
  },
  weekdaySelectionDotActive: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  daysHelperText: {
    fontSize: 13,
    color: Colors.textSecondary,
    lineHeight: 18,
    marginTop: 2,
  },
  dayCountBadge: {
    minWidth: 70,
    paddingHorizontal: 11,
    paddingVertical: 8,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: "#121212",
    alignItems: "center",
    justifyContent: "center",
  },
  dayCountBadgeActive: {
    backgroundColor: "#1F0B0B",
    borderColor: Colors.primary,
    shadowColor: Colors.primary,
    shadowOpacity: 0.3,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 6 },
    elevation: 4,
  },
  dayCountBadgeNumber: {
    fontSize: 18,
    fontWeight: "800" as const,
    color: Colors.text,
  },
  dayCountBadgeLabel: {
    fontSize: 11,
    color: Colors.textSecondary,
    marginTop: -2,
  },
  customGoalEditor: {
    marginTop: 12,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: "#141414",
    padding: 16,
    gap: 12,
  },
  customGoalLabel: {
    fontSize: 14,
    fontWeight: "600" as const,
    color: Colors.text,
  },
  customGoalInput: {
    minHeight: 88,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: "#0C0C0C",
    padding: 12,
    fontSize: 16,
    color: Colors.text,
    textAlignVertical: "top",
  },
  saveButton: {
    borderRadius: 16,
    paddingVertical: 14,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: Colors.primary,
  },
  saveButtonDisabled: {
    opacity: 0.5,
  },
  saveButtonPressed: {
    backgroundColor: Colors.primaryDark,
  },
  saveButtonText: {
    fontSize: 16,
    fontWeight: "700" as const,
    color: Colors.text,
  },
});
