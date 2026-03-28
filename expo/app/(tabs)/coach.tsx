import { StyleSheet, Text, View, ScrollView, TextInput, TouchableOpacity, KeyboardAvoidingView, Platform } from "react-native";
import { useState, useRef, useEffect } from "react";
import { useRorkAgent, createRorkTool } from "@/hooks/useCoachAgent";
import { z } from "zod";
import { useFitness } from "@/contexts/FitnessContext";
import { Send, Bot, User } from "lucide-react-native";
import Colors from "@/constants/colors";
import { Workout } from "@/types/fitness";
import { useSafeAreaInsets } from "react-native-safe-area-context";

export default function CoachScreen() {
  const [input, setInput] = useState("");
  const scrollViewRef = useRef<ScrollView>(null);
  const { userProfile, workouts, addWorkout } = useFitness();
  const insets = useSafeAreaInsets();

  const { messages, sendMessage } = useRorkAgent({
    tools: {
      createWorkout: createRorkTool({
        description: "Create a new workout plan for the user",
        zodSchema: z.object({
          date: z.string().describe("Date in YYYY-MM-DD format"),
          type: z.enum(["Push", "Pull", "Legs", "Upper", "Lower", "Full Body"]).describe("Type of workout"),
          title: z.string().describe("Workout title"),
          description: z.string().describe("Brief workout description"),
          exercises: z.array(z.object({
            name: z.string(),
            sets: z.number(),
            reps: z.string(),
            weight: z.number().optional(),
            notes: z.string().optional(),
          })).describe("List of exercises"),
        }),
        execute(params) {
          const workout: Workout = {
            id: Date.now().toString(),
            date: params.date,
            type: params.type,
            title: params.title,
            description: params.description,
            exercises: params.exercises.map((e, i) => ({
              id: `${Date.now()}-${i}`,
              name: e.name,
              sets: e.sets,
              reps: e.reps,
              weight: e.weight,
              notes: e.notes,
              completed: false,
            })),
            completed: false,
          };
          addWorkout(workout);
          return `Created workout: ${workout.title} for ${workout.date}`;
        },
      }),
      modifyWorkout: createRorkTool({
        description: "Modify an existing workout",
        zodSchema: z.object({
          workoutDate: z.string().describe("Date of workout to modify (YYYY-MM-DD)"),
          changes: z.string().describe("Description of changes made"),
        }),
        execute(params) {
          const workout = workouts.find(w => w.date === params.workoutDate);
          if (workout) {
            return `Workout for ${params.workoutDate} can be modified. Changes: ${params.changes}`;
          }
          return `No workout found for ${params.workoutDate}`;
        },
      }),
      getProgress: createRorkTool({
        description: "Get user's progress on their goals",
        zodSchema: z.object({
          exercise: z.string().optional().describe("Specific exercise to check progress on"),
        }),
        execute(params) {
          if (params.exercise) {
            const goal = userProfile.goals.find(g => 
              g.exercise.toLowerCase().includes(params.exercise!.toLowerCase())
            );
            if (goal) {
              const progress = ((goal.current / goal.target) * 100).toFixed(1);
              return `${goal.exercise}: ${goal.current} ${goal.unit} → ${goal.target} ${goal.unit} (${progress}% complete)`;
            }
            return `No goal found for ${params.exercise}`;
          }
          return userProfile.goals.map(g => {
            const progress = ((g.current / g.target) * 100).toFixed(1);
            return `${g.exercise}: ${g.current} → ${g.target} ${g.unit} (${progress}%)`;
          }).join("\n");
        },
      }),
    },
  });

  useEffect(() => {
    setTimeout(() => {
      scrollViewRef.current?.scrollToEnd({ animated: true });
    }, 100);
  }, [messages]);

  const handleSend = () => {
    if (input.trim()) {
      sendMessage(input.trim());
      setInput("");
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      keyboardVerticalOffset={Platform.OS === "ios" ? 90 : 0}
    >
      <View style={[styles.header, { paddingTop: Platform.OS === "web" ? 20 : insets.top + 20 }]}>
        <View style={styles.coachBadge}>
          <Bot size={24} color={Colors.primary} />
          <View>
            <Text style={styles.coachName}>Coach Rork</Text>
            <Text style={styles.coachSubtitle}>Your AI Strength Coach</Text>
          </View>
        </View>
      </View>

      <ScrollView
        ref={scrollViewRef}
        style={styles.messagesContainer}
        contentContainerStyle={styles.messagesContent}
        showsVerticalScrollIndicator={false}
      >
        {messages.length === 0 && (
          <View style={styles.emptyState}>
            <Bot size={48} color={Colors.textMuted} />
            <Text style={styles.emptyTitle}>Hey! I&apos;m Coach Rork</Text>
            <Text style={styles.emptyText}>
              Ask me anything about your workout, form tips, or training advice. I&apos;m here to help you crush your goals!
            </Text>
            <View style={styles.suggestionsContainer}>
              <TouchableOpacity
                style={styles.suggestion}
                onPress={() => sendMessage("What's my workout today?")}
              >
                <Text style={styles.suggestionText}>What&apos;s my workout today?</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.suggestion}
                onPress={() => sendMessage("How do I improve my bench press?")}
              >
                <Text style={styles.suggestionText}>How do I improve my bench?</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.suggestion}
                onPress={() => sendMessage("Create a pull workout for tomorrow")}
              >
                <Text style={styles.suggestionText}>Create a pull workout</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {messages.map((message) => (
          <View
            key={message.id}
            style={[
              styles.messageRow,
              message.role === "user" ? styles.userMessageRow : styles.assistantMessageRow,
            ]}
          >
            <View
              style={[
                styles.messageAvatar,
                message.role === "user" ? styles.userAvatar : styles.assistantAvatar,
              ]}
            >
              {message.role === "user" ? (
                <User size={18} color={Colors.text} />
              ) : (
                <Bot size={18} color={Colors.primary} />
              )}
            </View>
            <View
              style={[
                styles.messageBubble,
                message.role === "user" ? styles.userBubble : styles.assistantBubble,
              ]}
            >
              {message.parts.map((part, i) => {
                if (part.type === "text") {
                  return (
                    <Text
                      key={`${message.id}-${i}`}
                      style={[
                        styles.messageText,
                        message.role === "user" && styles.userMessageText,
                      ]}
                    >
                      {part.text}
                    </Text>
                  );
                }
                if (part.type === "tool") {
                  return (
                    <View key={`${message.id}-${i}`} style={styles.toolContainer}>
                      <Text style={styles.toolText}>
                        {part.state === "input-streaming" || part.state === "input-available"
                          ? `🔧 ${part.toolName}...`
                          : part.state === "output-available"
                          ? `✅ ${part.toolName} completed`
                          : `❌ Error: ${part.errorText}`}
                      </Text>
                    </View>
                  );
                }
                return null;
              })}
            </View>
          </View>
        ))}

        {false && (
          <View style={styles.loadingContainer}>
            <View style={styles.messageAvatar}>
              <Bot size={18} color={Colors.primary} />
            </View>
            <View style={styles.loadingBubble}>
              <View style={styles.typingDots}>
                <View style={[styles.dot, styles.dot1]} />
                <View style={[styles.dot, styles.dot2]} />
                <View style={[styles.dot, styles.dot3]} />
              </View>
            </View>
          </View>
        )}
      </ScrollView>

      <View style={styles.inputContainer}>
        <View style={styles.inputWrapper}>
          <TextInput
            style={styles.input}
            value={input}
            onChangeText={setInput}
            placeholder="Ask Coach Rork anything..."
            placeholderTextColor={Colors.textMuted}
            multiline
            maxLength={500}
          />
          <TouchableOpacity
            style={[styles.sendButton, !input.trim() && styles.sendButtonDisabled]}
            onPress={handleSend}
            disabled={!input.trim()}
          >
            <Send size={20} color={input.trim() ? Colors.text : Colors.textMuted} />
          </TouchableOpacity>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  header: {
    paddingHorizontal: 20,
    paddingBottom: 16,
    backgroundColor: Colors.cardBackground,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  coachBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  coachName: {
    fontSize: 18,
    fontWeight: "700" as const,
    color: Colors.text,
  },
  coachSubtitle: {
    fontSize: 13,
    color: Colors.textSecondary,
  },
  messagesContainer: {
    flex: 1,
  },
  messagesContent: {
    padding: 20,
    paddingBottom: 10,
  },
  emptyState: {
    alignItems: "center",
    justifyContent: "center",
    paddingTop: 60,
  },
  emptyTitle: {
    fontSize: 24,
    fontWeight: "700" as const,
    color: Colors.text,
    marginTop: 16,
    marginBottom: 8,
  },
  emptyText: {
    fontSize: 14,
    color: Colors.textSecondary,
    textAlign: "center",
    lineHeight: 20,
    marginBottom: 24,
    paddingHorizontal: 20,
  },
  suggestionsContainer: {
    gap: 8,
    width: "100%",
  },
  suggestion: {
    backgroundColor: Colors.cardBackground,
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  suggestionText: {
    fontSize: 14,
    color: Colors.text,
    textAlign: "center",
  },
  messageRow: {
    flexDirection: "row",
    marginBottom: 16,
    gap: 12,
  },
  userMessageRow: {
    justifyContent: "flex-end",
  },
  assistantMessageRow: {
    justifyContent: "flex-start",
  },
  messageAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  userAvatar: {
    backgroundColor: Colors.primary,
  },
  assistantAvatar: {
    backgroundColor: Colors.cardBackground,
  },
  messageBubble: {
    maxWidth: "75%",
    padding: 12,
    borderRadius: 16,
  },
  userBubble: {
    backgroundColor: Colors.primary,
    borderBottomRightRadius: 4,
  },
  assistantBubble: {
    backgroundColor: Colors.cardBackground,
    borderBottomLeftRadius: 4,
  },
  messageText: {
    fontSize: 15,
    color: Colors.text,
    lineHeight: 20,
  },
  userMessageText: {
    color: Colors.text,
  },
  toolContainer: {
    marginTop: 8,
    padding: 8,
    backgroundColor: "rgba(255, 255, 255, 0.1)",
    borderRadius: 8,
  },
  toolText: {
    fontSize: 12,
    color: Colors.textSecondary,
  },
  loadingContainer: {
    flexDirection: "row",
    gap: 12,
    marginBottom: 16,
  },
  loadingBubble: {
    backgroundColor: Colors.cardBackground,
    padding: 16,
    borderRadius: 16,
    borderBottomLeftRadius: 4,
  },
  typingDots: {
    flexDirection: "row",
    gap: 4,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: Colors.textMuted,
  },
  dot1: {},
  dot2: {},
  dot3: {},
  inputContainer: {
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: Colors.cardBackground,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  inputWrapper: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 12,
    backgroundColor: Colors.background,
    borderRadius: 24,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  input: {
    flex: 1,
    fontSize: 15,
    color: Colors.text,
    maxHeight: 100,
    paddingVertical: 8,
  },
  sendButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: Colors.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  sendButtonDisabled: {
    backgroundColor: Colors.cardBackground,
  },
});
