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

export interface AgentTool {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
  /** Executes the action for real (e.g. against the database) and returns a
   * small JSON-serializable result Claude can read back. Throwing is caught
   * and reported back to Claude as an error result, not a crash. */
  execute: (input: any) => Promise<unknown>;
}

export interface AgentTurnResult {
  finalText: string;
  /** Human-readable log of every tool call actually executed, in order. */
  actionsTaken: string[];
}

/** Runs a multi-turn tool-use loop: lets Claude call one or more tools,
 * executes them for real, feeds the results back, and repeats until Claude
 * replies with plain text (or the iteration cap is hit). This is what lets
 * the coach chat actually create/edit programs instead of only describing them. */
export async function callClaudeWithTools(params: {
  system: string;
  messages: { role: "user" | "assistant"; content: string }[];
  tools: AgentTool[];
  maxTokens?: number;
  maxIterations?: number;
}): Promise<AgentTurnResult> {
  const client = getClient();
  const anthropicTools: Anthropic.Tool[] = params.tools.map((t) => ({
    name: t.name,
    description: t.description,
    input_schema: t.inputSchema as Anthropic.Tool.InputSchema,
  }));

  const messages: Anthropic.MessageParam[] = params.messages.map((m) => ({
    role: m.role,
    content: m.content,
  }));
  const actionsTaken: string[] = [];
  const maxIterations = params.maxIterations ?? 4;

  for (let i = 0; i < maxIterations; i++) {
    const response = await client.messages.create({
      model: env.anthropicModel,
      max_tokens: params.maxTokens ?? 1024,
      system: params.system,
      messages,
      tools: anthropicTools,
    });

    const toolUses = response.content.filter(
      (b): b is Anthropic.ToolUseBlock => b.type === "tool_use"
    );

    if (toolUses.length === 0) {
      const textBlock = response.content.find((b) => b.type === "text");
      return { finalText: textBlock && textBlock.type === "text" ? textBlock.text : "", actionsTaken };
    }

    messages.push({ role: "assistant", content: response.content });

    const toolResults: Anthropic.ToolResultBlockParam[] = [];
    for (const toolUse of toolUses) {
      const tool = params.tools.find((t) => t.name === toolUse.name);
      let resultText: string;
      try {
        if (!tool) throw new Error(`Onbekende actie: ${toolUse.name}`);
        const result = await tool.execute(toolUse.input);
        resultText = JSON.stringify(result ?? { ok: true });
        actionsTaken.push(`${tool.name}(${JSON.stringify(toolUse.input)})`);
      } catch (err) {
        resultText = JSON.stringify({ error: (err as Error).message });
      }
      toolResults.push({ type: "tool_result", tool_use_id: toolUse.id, content: resultText });
    }
    messages.push({ role: "user", content: toolResults });
  }

  return {
    finalText: "Ik heb een aantal wijzigingen gedaan, maar het gesprek werd te lang om af te ronden — vraag gerust door.",
    actionsTaken,
  };
}
