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

/** Sends one image (as a data URL, e.g. from ProgressPhoto.imageData) to Claude for
 * visual analysis alongside a text prompt. Used for physique-photo analysis — kept as
 * a separate one-off call rather than threading images through the main chat history,
 * so ordinary text turns stay cheap and simple. */
export async function analyzeImage(params: { imageDataUrl: string; prompt: string; maxTokens?: number }): Promise<string> {
  const match = params.imageDataUrl.match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,(.+)$/);
  if (!match) throw new Error("Ongeldige afbeelding: verwacht een base64 data-URL.");
  const [, mediaType, base64Data] = match;

  const response = await getClient().messages.create({
    model: env.anthropicModel,
    max_tokens: params.maxTokens ?? 1024,
    messages: [
      {
        role: "user",
        content: [
          {
            type: "image",
            source: { type: "base64", media_type: mediaType as "image/jpeg" | "image/png" | "image/gif" | "image/webp", data: base64Data },
          },
          { type: "text", text: params.prompt },
        ],
      },
    ],
  });
  const textBlock = response.content.find((b) => b.type === "text");
  return textBlock && textBlock.type === "text" ? textBlock.text.trim() : "";
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
  // Building a whole multi-day program can genuinely take several tool calls
  // (list_programs, then one add_exercise_to_program per exercise) — 4 was too
  // low and left real work half-summarized.
  const maxIterations = params.maxIterations ?? 10;
  let emptyResponseRetries = 0;

  for (let i = 0; i < maxIterations; i++) {
    const response = await client.messages.create({
      model: env.anthropicModel,
      max_tokens: params.maxTokens ?? 1536,
      system: params.system,
      messages,
      tools: anthropicTools,
    });

    const toolUses = response.content.filter(
      (b): b is Anthropic.ToolUseBlock => b.type === "tool_use"
    );

    if (toolUses.length === 0) {
      const textBlock = response.content.find((b) => b.type === "text");
      const text = textBlock && textBlock.type === "text" ? textBlock.text.trim() : "";
      // If Claude was cut off by the token limit while still writing plain text (e.g.
      // typing out a whole program in prose instead of calling the tools), don't show
      // the reader a sentence that stops mid-word — push what it wrote so far and nudge
      // it to actually build the thing via tools instead of describing it.
      if (text && response.stop_reason === "max_tokens") {
        messages.push({ role: "assistant", content: response.content });
        messages.push({
          role: "user",
          content:
            "Je antwoord werd afgebroken door de lengtelimiet. Stop met het uitschrijven van het schema in platte tekst — gebruik nu direct de tools (create_program/add_exercise_to_program) om het echt aan te maken, en geef pas daarna een korte samenvatting.",
        });
        continue;
      }
      if (text) return { finalText: text, actionsTaken };
      // Claude sometimes ends a tool-use turn without any closing text at all.
      // Rather than show an empty bubble, force one more plain-text turn asking
      // it to summarize what it just did.
      if (actionsTaken.length > 0) {
        return { finalText: await summarizeActions(client, params.system, actionsTaken), actionsTaken };
      }
      // No tool calls and no text at all — an occasional transient blank generation,
      // usually for a big/vague first request. Retry a couple of times before giving up.
      if (emptyResponseRetries < 2) {
        emptyResponseRetries++;
        continue;
      }
      return { finalText: "Kun je dat anders formuleren? Ik kreeg geen duidelijk antwoord samen.", actionsTaken };
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

  if (actionsTaken.length === 0) {
    return {
      finalText: "Kun je dat anders formuleren? Ik kreeg geen duidelijk antwoord samen.",
      actionsTaken,
    };
  }
  return {
    finalText: await summarizeActions(client, params.system, actionsTaken).catch(
      () => "Ik heb een aantal wijzigingen gedaan, maar het gesprek werd te lang om af te ronden — vraag gerust door wat er precies is gebeurd."
    ),
    actionsTaken,
  };
}

/** Forces a short plain-text (no tools) summary of what was just done, for the
 * case where Claude finishes a string of tool calls without ever writing a
 * closing message on its own. */
async function summarizeActions(client: Anthropic, system: string, actionsTaken: string[]): Promise<string> {
  const response = await client.messages.create({
    model: env.anthropicModel,
    max_tokens: 300,
    system,
    messages: [
      {
        role: "user",
        content: `Je hebt zojuist deze acties uitgevoerd: ${actionsTaken.join(
          "; "
        )}. Vat in 1-2 korte zinnen in het Nederlands samen wat je hebt gedaan, in mensentaal (geen technische namen of JSON). Geen tools gebruiken, alleen platte tekst.`,
      },
    ],
  });
  const textBlock = response.content.find((b) => b.type === "text");
  const text = textBlock && textBlock.type === "text" ? textBlock.text.trim() : "";
  return text || "Klaar! Ik heb de gevraagde wijzigingen doorgevoerd.";
}
