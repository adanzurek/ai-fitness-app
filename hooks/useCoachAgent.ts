import { useCallback, useState } from "react";
import type { ZodTypeAny } from "zod";

type ToolState = "input-streaming" | "input-available" | "output-available" | "error";

type ToolMessagePart = {
  type: "tool";
  toolName: string;
  state: ToolState;
  errorText?: string;
};

type TextMessagePart = {
  type: "text";
  text: string;
};

type AgentMessagePart = ToolMessagePart | TextMessagePart;

type AgentMessage = {
  id: string;
  role: "user" | "assistant";
  parts: AgentMessagePart[];
};

type InferSchema<TSchema extends ZodTypeAny> = TSchema["_output"];

type ToolDefinitionInput<TSchema extends ZodTypeAny> = {
  description: string;
  zodSchema: TSchema;
  execute: (params: InferSchema<TSchema>) => Promise<string | void> | string | void;
};

type ToolInstance = {
  description: string;
  zodSchema: ZodTypeAny;
  execute: (params: unknown) => Promise<string | void> | string | void;
};

export function createRorkTool<TSchema extends ZodTypeAny>(config: ToolDefinitionInput<TSchema>): ToolInstance {
  return config;
}

type ToolRegistry = Record<string, ToolInstance>;

type UseAgentOptions = {
  tools?: ToolRegistry;
};

const randomId = () => `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

const coachReplies = [
  "Got it! I'm running locally, so use `/toolName { ... }` commands if you need to trigger Supabase tools directly.",
  "Thanks for the update. The Supabase Tools tab is still available for deeper workflows while the cloud agent is offline.",
  "Message received. Type something like `/createWorkout {\"date\":\"2024-10-01\", ...}` to run a tool with JSON input.",
];

const buildAssistantMessage = (text: string): AgentMessage => ({
  id: randomId(),
  role: "assistant",
  parts: [{ type: "text", text }],
});

export function useRorkAgent({ tools = {} }: UseAgentOptions) {
  const [messages, setMessages] = useState<AgentMessage[]>([]);

  const sendMessage = useCallback(
    async (rawInput: string) => {
      const trimmed = rawInput.trim();
      if (!trimmed) return;

      const userMessage: AgentMessage = {
        id: randomId(),
        role: "user",
        parts: [{ type: "text", text: trimmed }],
      };

      setMessages((prev) => [...prev, userMessage]);

      const commandMatch = trimmed.match(/^\/([\w-]+)\s*(.*)$/s);

      if (!commandMatch) {
        const reply = coachReplies[Math.floor(Math.random() * coachReplies.length)];
        setMessages((prev) => [...prev, buildAssistantMessage(reply)]);
        return;
      }

      const [, toolName, payloadText] = commandMatch;
      const tool = tools[toolName];

      if (!tool) {
        const available = Object.keys(tools);
        const listText = available.length ? available.join(", ") : "none";
        setMessages((prev) => [
          ...prev,
          buildAssistantMessage(`Unknown tool \`${toolName}\`. Available tools: ${listText}.`),
        ]);
        return;
      }

      const toolMessageId = randomId();
      setMessages((prev) => [
        ...prev,
        {
          id: toolMessageId,
          role: "assistant",
          parts: [{ type: "tool", toolName, state: "input-streaming" }],
        },
      ]);

      const updateToolMessage = (state: ToolState, extraParts: AgentMessagePart[] = [], errorText?: string) => {
        setMessages((prev) =>
          prev.map((message) =>
            message.id === toolMessageId
              ? { ...message, parts: [{ type: "tool", toolName, state, errorText }, ...extraParts] }
              : message,
          ),
        );
      };

      let parsedPayload: unknown = {};
      if (payloadText?.trim()) {
        try {
          parsedPayload = JSON.parse(payloadText);
        } catch (error) {
          updateToolMessage(
            "error",
            [],
            `Invalid JSON payload: ${error instanceof Error ? error.message : "Unknown error"}`,
          );
          return;
        }
      }

      try {
        const params = tool.zodSchema.safeParse(parsedPayload);
        if (!params.success) {
          updateToolMessage("error", [], params.error.message);
          return;
        }

        updateToolMessage("input-available");

        const result = await tool.execute(params.data);

        const textPart: AgentMessagePart[] =
          typeof result === "string" && result.trim().length > 0
            ? [{ type: "text", text: result.trim() }]
            : [];

        updateToolMessage("output-available", textPart);
      } catch (error) {
        const message =
          error instanceof Error ? error.message : typeof error === "string" ? error : "Unknown tool execution error.";
        updateToolMessage("error", [], message);
      }
    },
    [tools],
  );

  return { messages, sendMessage };
}

export type { AgentMessage, AgentMessagePart };

