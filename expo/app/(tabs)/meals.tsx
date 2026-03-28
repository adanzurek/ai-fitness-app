import { StyleSheet, Text, View, ScrollView, Platform } from "react-native";
import { useFitness } from "@/contexts/FitnessContext";
import { UtensilsCrossed, Flame as FlameIcon, Beef, Wheat, Droplet } from "lucide-react-native";
import Colors from "@/constants/colors";
import { useSafeAreaInsets } from "react-native-safe-area-context";

const defaultMacros = {
  calories: 2800,
  protein: 180,
  carbs: 320,
  fats: 85,
};

const sampleMeals = [
  {
    id: "1",
    name: "Breakfast",
    time: "7:30 AM",
    items: ["4 eggs", "2 slices whole wheat toast", "1 banana", "Coffee"],
    macros: { calories: 620, protein: 36, carbs: 58, fats: 24 },
  },
  {
    id: "2",
    name: "Pre-Workout",
    time: "11:00 AM",
    items: ["Protein shake", "Apple", "Almonds (1 oz)"],
    macros: { calories: 380, protein: 32, carbs: 42, fats: 12 },
  },
  {
    id: "3",
    name: "Post-Workout",
    time: "1:30 PM",
    items: ["8 oz chicken breast", "2 cups rice", "Broccoli"],
    macros: { calories: 780, protein: 62, carbs: 98, fats: 8 },
  },
  {
    id: "4",
    name: "Dinner",
    time: "7:00 PM",
    items: ["6 oz salmon", "Sweet potato", "Mixed vegetables", "Olive oil"],
    macros: { calories: 680, protein: 48, carbs: 64, fats: 26 },
  },
  {
    id: "5",
    name: "Evening Snack",
    time: "9:30 PM",
    items: ["Greek yogurt", "Berries", "Honey"],
    macros: { calories: 280, protein: 18, carbs: 42, fats: 6 },
  },
];

export default function MealsScreen() {
  const { userProfile } = useFitness();
  const insets = useSafeAreaInsets();

  const totalConsumed = sampleMeals.reduce(
    (acc, meal) => ({
      calories: acc.calories + meal.macros.calories,
      protein: acc.protein + meal.macros.protein,
      carbs: acc.carbs + meal.macros.carbs,
      fats: acc.fats + meal.macros.fats,
    }),
    { calories: 0, protein: 0, carbs: 0, fats: 0 }
  );

  const calorieProgress = (totalConsumed.calories / defaultMacros.calories) * 100;
  const proteinProgress = (totalConsumed.protein / defaultMacros.protein) * 100;
  const carbsProgress = (totalConsumed.carbs / defaultMacros.carbs) * 100;
  const fatsProgress = (totalConsumed.fats / defaultMacros.fats) * 100;

  return (
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: insets.bottom + 100 }}>
      <View style={[styles.header, { paddingTop: Platform.OS === "web" ? 20 : insets.top + 20 }]}>
        <Text style={styles.title}>Nutrition</Text>
        <Text style={styles.subtitle}>Fuel your gains, {userProfile.name}</Text>
      </View>

      <View style={styles.summaryCard}>
        <View style={styles.calorieSection}>
          <View style={styles.calorieContent}>
            <FlameIcon size={32} color={Colors.primary} fill={Colors.primary} />
            <View>
              <Text style={styles.calorieNumber}>{totalConsumed.calories}</Text>
              <Text style={styles.calorieLabel}>/ {defaultMacros.calories} cal</Text>
            </View>
          </View>
          <View style={styles.calorieProgressRing}>
            <Text style={styles.caloriePercent}>{Math.round(calorieProgress)}%</Text>
          </View>
        </View>

        <View style={styles.macrosGrid}>
          <View style={styles.macroCard}>
            <Beef size={20} color={Colors.primary} />
            <Text style={styles.macroValue}>{totalConsumed.protein}g</Text>
            <Text style={styles.macroLabel}>Protein</Text>
            <View style={styles.macroBar}>
              <View
                style={[
                  styles.macroBarFill,
                  { width: `${Math.min(proteinProgress, 100)}%`, backgroundColor: Colors.primary },
                ]}
              />
            </View>
            <Text style={styles.macroTarget}>of {defaultMacros.protein}g</Text>
          </View>

          <View style={styles.macroCard}>
            <Wheat size={20} color="#F59E0B" />
            <Text style={styles.macroValue}>{totalConsumed.carbs}g</Text>
            <Text style={styles.macroLabel}>Carbs</Text>
            <View style={styles.macroBar}>
              <View
                style={[
                  styles.macroBarFill,
                  { width: `${Math.min(carbsProgress, 100)}%`, backgroundColor: "#F59E0B" },
                ]}
              />
            </View>
            <Text style={styles.macroTarget}>of {defaultMacros.carbs}g</Text>
          </View>

          <View style={styles.macroCard}>
            <Droplet size={20} color="#3B82F6" />
            <Text style={styles.macroValue}>{totalConsumed.fats}g</Text>
            <Text style={styles.macroLabel}>Fats</Text>
            <View style={styles.macroBar}>
              <View
                style={[
                  styles.macroBarFill,
                  { width: `${Math.min(fatsProgress, 100)}%`, backgroundColor: "#3B82F6" },
                ]}
              />
            </View>
            <Text style={styles.macroTarget}>of {defaultMacros.fats}g</Text>
          </View>
        </View>
      </View>

      <View style={styles.mealsSection}>
        <View style={styles.mealsSectionHeader}>
          <UtensilsCrossed size={20} color={Colors.primary} />
          <Text style={styles.sectionTitle}>Today&apos;s Meals</Text>
        </View>

        {sampleMeals.map((meal, index) => (
          <View key={meal.id} style={styles.mealCard}>
            <View style={styles.mealHeader}>
              <View>
                <Text style={styles.mealName}>{meal.name}</Text>
                <Text style={styles.mealTime}>{meal.time}</Text>
              </View>
              <View style={styles.mealCalories}>
                <Text style={styles.mealCaloriesNumber}>{meal.macros.calories}</Text>
                <Text style={styles.mealCaloriesLabel}>cal</Text>
              </View>
            </View>

            <View style={styles.mealItems}>
              {meal.items.map((item, i) => (
                <Text key={i} style={styles.mealItem}>
                  • {item}
                </Text>
              ))}
            </View>

            <View style={styles.mealMacros}>
              <View style={styles.mealMacro}>
                <Text style={styles.mealMacroValue}>{meal.macros.protein}g</Text>
                <Text style={styles.mealMacroLabel}>Protein</Text>
              </View>
              <View style={styles.mealMacro}>
                <Text style={styles.mealMacroValue}>{meal.macros.carbs}g</Text>
                <Text style={styles.mealMacroLabel}>Carbs</Text>
              </View>
              <View style={styles.mealMacro}>
                <Text style={styles.mealMacroValue}>{meal.macros.fats}g</Text>
                <Text style={styles.mealMacroLabel}>Fats</Text>
              </View>
            </View>
          </View>
        ))}
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
  summaryCard: {
    backgroundColor: Colors.cardBackground,
    marginHorizontal: 20,
    marginBottom: 24,
    padding: 20,
    borderRadius: 16,
  },
  calorieSection: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 24,
    paddingBottom: 20,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  calorieContent: {
    flexDirection: "row",
    alignItems: "center",
    gap: 16,
  },
  calorieNumber: {
    fontSize: 32,
    fontWeight: "700" as const,
    color: Colors.text,
  },
  calorieLabel: {
    fontSize: 14,
    color: Colors.textSecondary,
  },
  calorieProgressRing: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: Colors.background,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 4,
    borderColor: Colors.primary,
  },
  caloriePercent: {
    fontSize: 16,
    fontWeight: "700" as const,
    color: Colors.text,
  },
  macrosGrid: {
    flexDirection: "row",
    gap: 12,
  },
  macroCard: {
    flex: 1,
    alignItems: "center",
    gap: 6,
  },
  macroValue: {
    fontSize: 20,
    fontWeight: "700" as const,
    color: Colors.text,
  },
  macroLabel: {
    fontSize: 12,
    color: Colors.textSecondary,
  },
  macroBar: {
    width: "100%",
    height: 4,
    backgroundColor: Colors.background,
    borderRadius: 2,
    overflow: "hidden",
  },
  macroBarFill: {
    height: "100%",
    borderRadius: 2,
  },
  macroTarget: {
    fontSize: 10,
    color: Colors.textMuted,
  },
  mealsSection: {
    paddingHorizontal: 20,
  },
  mealsSectionHeader: {
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
  mealCard: {
    backgroundColor: Colors.cardBackground,
    padding: 16,
    borderRadius: 16,
    marginBottom: 12,
  },
  mealHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 12,
  },
  mealName: {
    fontSize: 18,
    fontWeight: "600" as const,
    color: Colors.text,
    marginBottom: 4,
  },
  mealTime: {
    fontSize: 13,
    color: Colors.textSecondary,
  },
  mealCalories: {
    alignItems: "center",
  },
  mealCaloriesNumber: {
    fontSize: 24,
    fontWeight: "700" as const,
    color: Colors.primary,
  },
  mealCaloriesLabel: {
    fontSize: 12,
    color: Colors.textSecondary,
  },
  mealItems: {
    marginBottom: 12,
    gap: 4,
  },
  mealItem: {
    fontSize: 14,
    color: Colors.textSecondary,
  },
  mealMacros: {
    flexDirection: "row",
    justifyContent: "space-around",
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  mealMacro: {
    alignItems: "center",
  },
  mealMacroValue: {
    fontSize: 16,
    fontWeight: "600" as const,
    color: Colors.text,
    marginBottom: 2,
  },
  mealMacroLabel: {
    fontSize: 11,
    color: Colors.textMuted,
  },
  bottomPadding: {
    height: 20,
  },
});
