import Anthropic from "@anthropic-ai/sdk";
import { env } from "../../env.js";

let client: Anthropic | null = null;

function getClient(): Anthropic {
  if (!env.anthropicApiKey) {
    throw new Error("ANTHROPIC_API_KEY is niet ingesteld op de server.");
  }
  if (!client) {
    client = new Anthropic({ apiKey: env.anthropicApiKey });
  }
  return client;
}

export async function callClaude(params: {
  system: string;
  messages: { role: "user" | "assistant"; content: string }[];
  maxTokens?: number;
}): Promise<string> {
  const response = await getClient().messages.create({
    model: env.anthropicModel,
    max_tokens: params.maxTokens ?? 1024,
    system: params.system,
    messages: params.messages,
  });
  const textBlock = response.content.find((b) => b.type === "text");
  return textBlock && textBlock.type === "text" ? textBlock.text : "";
}

/** Calls Claude with a tool definition that forces a single structured JSON reply. */
export async function callClaudeJson<T>(params: {
  system: string;
  messages: { role: "user" | "assistant"; content: string }[];
  toolName: string;
  toolDescription: string;
  inputSchema: Record<string, unknown>;
  maxTokens?: number;
}): Promise<T> {
  const response = await getClient().messages.create({
    model: env.anthropicModel,
    max_tokens: params.maxTokens ?? 2048,
    system: params.system,
    messages: params.messages,
    tools: [
      {
        name: params.toolName,
        description: params.toolDescription,
        input_schema: params.inputSchema as Anthropic.Tool.InputSchema,
      },
    ],
    tool_choice: { type: "tool", name: params.toolName },
  });
  const toolUse = response.content.find((b) => b.type === "tool_use");
  if (!toolUse || toolUse.type !== "tool_use") {
    throw new Error("Claude gaf geen gestructureerd antwoord terug.");
  }
  return toolUse.input as T;
}
