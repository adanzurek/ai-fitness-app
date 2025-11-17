import { useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  Platform,
} from "react-native";
import Colors from "@/constants/colors";
import { supabase, isSupabaseConfigured } from "@/lib/supabase";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useQueryClient } from "@tanstack/react-query";

type FunctionTemplateKey = keyof typeof FUNCTION_TEMPLATES;

const FUNCTION_TEMPLATES = {
  compose_today: (userId: string) =>
    JSON.stringify(
      {
        user_id: userId,
        date: new Date().toISOString().split("T")[0],
      },
      null,
      2,
    ),
  finish_workout: (userId: string) =>
    JSON.stringify(
      {
        user_id: userId,
        session_id: "session-uuid",
      },
      null,
      2,
    ),
  auto_modulate: (userId: string) =>
    JSON.stringify(
      {
        user_id: userId,
        session_id: "session-uuid",
      },
      null,
      2,
    ),
  month_calendar: (userId: string) =>
    JSON.stringify(
      (() => {
        const now = new Date();
        const month = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
        return {
          user_id: userId,
          month,
        };
      })(),
      null,
      2,
    ),
  set_outcome: (userId: string) =>
    JSON.stringify(
      {
        user_id: userId,
        date: new Date().toISOString().split("T")[0],
        completed: true,
      },
      null,
      2,
    ),
  onboard_goal: (userId: string) =>
    JSON.stringify(
      {
        user_id: userId,
        goal: "increase bench press by 25 lbs",
      },
      null,
      2,
    ),
  apply_program: (userId: string) =>
    JSON.stringify(
      {
        user_id: userId,
      },
      null,
      2,
    ),
  generate_plan_ai: (userId: string) =>
    JSON.stringify(
      {
        user_id: userId,
      },
      null,
      2,
    ),
  generate_week: (userId: string) =>
    JSON.stringify(
      {
        user_id: userId,
        // goal: "increase bench press by 25 pounds",
        // training_days: 4,
        // experience_level: "intermediate",
        // start_date: new Date().toISOString().split("T")[0],
        // plan_id: "00000000-0000-0000-0000-000000000000",
      },
      null,
      2,
    ),
  progress_summary: (userId: string) =>
    JSON.stringify(
      {
        user_id: userId,
      },
      null,
      2,
    ),
} as const;

type ToolLog = {
  id: string;
  functionName: string;
  payload: string;
  response: string;
  isError: boolean;
  timestamp: string;
};

export default function ToolsScreen() {
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();
  const [functionName, setFunctionName] = useState<FunctionTemplateKey>("compose_today");
  const [userId, setUserId] = useState("00000000-0000-0000-0000-000000000000");
  const [payloadText, setPayloadText] = useState(FUNCTION_TEMPLATES.compose_today(userId));
  const [logs, setLogs] = useState<ToolLog[]>([]);
  const [loading, setLoading] = useState(false);

  const isReady = isSupabaseConfigured;

  const parsedPayload = useMemo(() => {
    try {
      return payloadText.trim() ? JSON.parse(payloadText) : {};
    } catch {
      return null;
    }
  }, [payloadText]);

  const updatePayloadForTemplate = (fnName: FunctionTemplateKey, nextUserId: string) => {
    setPayloadText(FUNCTION_TEMPLATES[fnName](nextUserId));
  };

  const handleChangeFunction = (fnName: FunctionTemplateKey) => {
    setFunctionName(fnName);
    updatePayloadForTemplate(fnName, userId);
  };

  const handleUserIdChange = (value: string) => {
    setUserId(value);
    updatePayloadForTemplate(functionName, value);
  };

  const callFunction = async () => {
    if (!parsedPayload) {
      Alert.alert("Invalid JSON", "Please fix the payload format before calling the function.");
      return;
    }

    try {
      setLoading(true);
      const { data, error } = await supabase.functions.invoke(functionName, {
        body: parsedPayload,
      });

      if (!error) {
        refreshClientCache(functionName);
      }
      const response = error ? error.message : JSON.stringify(data, null, 2);
      setLogs((prev) => [
        {
          id: Date.now().toString(),
          functionName,
          payload: JSON.stringify(parsedPayload, null, 2),
          response,
          isError: Boolean(error),
          timestamp: new Date().toLocaleString(),
        },
        ...prev,
      ]);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      setLogs((prev) => [
        {
          id: Date.now().toString(),
          functionName,
          payload: JSON.stringify(parsedPayload, null, 2),
          response: message,
          isError: true,
          timestamp: new Date().toLocaleString(),
        },
        ...prev,
      ]);
    } finally {
      setLoading(false);
    }
  };

  const refreshClientCache = (fnName: FunctionTemplateKey) => {
    const invalidatesCalendar = [
      "generate_week",
      "month_calendar",
      "set_outcome",
      "compose_today",
      "generate_plan_ai",
      "apply_program",
    ];

    if (invalidatesCalendar.includes(fnName)) {
      queryClient.invalidateQueries({ queryKey: ["month_calendar"], exact: false }).catch(() => undefined);
    }
  };

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={{ paddingBottom: insets.bottom + 40 }}
      keyboardShouldPersistTaps="handled"
    >
      <View style={[styles.header, { paddingTop: Platform.OS === "web" ? 20 : insets.top + 20 }]}>
        <Text style={styles.title}>Supabase Tools</Text>
        <Text style={styles.subtitle}>Invoke Edge Functions directly from the app.</Text>
      </View>

      {!isReady && (
        <View style={styles.warningBox}>
          <Text style={styles.warningText}>
            Provide `EXPO_PUBLIC_SUPABASE_URL` and `EXPO_PUBLIC_SUPABASE_ANON_KEY` in your env before calling
            functions.
          </Text>
        </View>
      )}

      <View style={styles.card}>
        <Text style={styles.sectionLabel}>Function</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.functionRow}>
          {(Object.keys(FUNCTION_TEMPLATES) as FunctionTemplateKey[]).map((fn) => (
            <TouchableOpacity
              key={fn}
              style={[styles.functionChip, functionName === fn && styles.functionChipActive]}
              onPress={() => handleChangeFunction(fn)}
              disabled={!isReady}
            >
              <Text
                style={[
                  styles.functionChipText,
                  functionName === fn && styles.functionChipTextActive,
                ]}
              >
                {fn}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        <Text style={styles.sectionLabel}>User ID</Text>
        <TextInput
          style={styles.input}
          value={userId}
          onChangeText={handleUserIdChange}
          editable={isReady}
          autoCapitalize="none"
        />

        <Text style={styles.sectionLabel}>JSON Payload</Text>
        <TextInput
          style={styles.payloadInput}
          value={payloadText}
          onChangeText={setPayloadText}
          editable={isReady}
          multiline
          autoCapitalize="none"
          autoCorrect={false}
        />

        <TouchableOpacity
          style={[styles.callButton, (!isReady || loading) && styles.callButtonDisabled]}
          onPress={callFunction}
          disabled={!isReady || loading}
        >
          {loading ? (
            <ActivityIndicator color="#000" />
          ) : (
            <Text style={styles.callButtonText}>Invoke {functionName}</Text>
          )}
        </TouchableOpacity>
      </View>

      {logs.length > 0 && (
        <View style={styles.card}>
          <Text style={styles.sectionLabel}>History</Text>
          {logs.map((log) => (
            <View key={log.id} style={styles.logItem}>
              <View style={styles.logHeader}>
                <Text style={styles.logTitle}>{log.functionName}</Text>
                <Text style={styles.logTimestamp}>{log.timestamp}</Text>
              </View>
              <Text style={styles.logLabel}>Payload</Text>
              <Text style={styles.logCode}>{log.payload}</Text>
              <Text style={styles.logLabel}>Response</Text>
              <Text style={[styles.logCode, log.isError && styles.logError]}>{log.response}</Text>
            </View>
          ))}
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
    paddingHorizontal: 20,
  },
  header: {
    marginBottom: 20,
  },
  title: {
    fontSize: 32,
    fontWeight: "700" as const,
    color: Colors.text,
  },
  subtitle: {
    fontSize: 14,
    color: Colors.textSecondary,
  },
  warningBox: {
    backgroundColor: "#3b1f1f",
    borderRadius: 12,
    padding: 16,
    marginBottom: 20,
  },
  warningText: {
    color: "#ffb4b4",
    fontSize: 14,
  },
  card: {
    backgroundColor: Colors.cardBackground,
    borderRadius: 20,
    padding: 20,
    marginBottom: 20,
  },
  sectionLabel: {
    fontSize: 13,
    color: Colors.textSecondary,
    marginBottom: 6,
    textTransform: "uppercase",
    letterSpacing: 1,
  },
  functionRow: {
    marginBottom: 16,
  },
  functionChip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: Colors.border,
    marginRight: 8,
  },
  functionChipActive: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  functionChipText: {
    color: Colors.text,
    fontSize: 13,
  },
  functionChipTextActive: {
    color: Colors.background,
  },
  input: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: Colors.text,
    marginBottom: 16,
    backgroundColor: Colors.background,
  },
  payloadInput: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: 14,
    color: Colors.text,
    minHeight: 160,
    textAlignVertical: "top",
    backgroundColor: Colors.background,
  },
  callButton: {
    marginTop: 16,
    backgroundColor: Colors.primary,
    borderRadius: 16,
    paddingVertical: 16,
    alignItems: "center",
  },
  callButtonDisabled: {
    opacity: 0.4,
  },
  callButtonText: {
    color: Colors.background,
    fontWeight: "700" as const,
    fontSize: 16,
  },
  logItem: {
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    paddingVertical: 16,
  },
  logHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 8,
  },
  logTitle: {
    color: Colors.text,
    fontWeight: "600" as const,
  },
  logTimestamp: {
    color: Colors.textSecondary,
    fontSize: 12,
  },
  logLabel: {
    color: Colors.textSecondary,
    fontSize: 12,
    marginTop: 8,
  },
  logCode: {
    fontFamily: Platform.select({ ios: "Menlo", android: "monospace", default: "Courier" }),
    fontSize: 12,
    color: Colors.text,
    marginTop: 4,
  },
  logError: {
    color: Colors.primary,
  },
});
