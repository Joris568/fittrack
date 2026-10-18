import { prisma } from "../../db.js";

interface RawUsage {
  input_tokens?: number | null;
  output_tokens?: number | null;
  cache_read_input_tokens?: number | null;
  cache_creation_input_tokens?: number | null;
}

/** Fire-and-forget: tracking must never break or slow an AI reply. */
export function recordUsage(label: string, model: string, usage: RawUsage | undefined) {
  if (!usage) return;
  prisma.aiUsage
    .create({
      data: {
        label,
        model,
        inputTokens: usage.input_tokens ?? 0,
        outputTokens: usage.output_tokens ?? 0,
        cacheReadTokens: usage.cache_read_input_tokens ?? 0,
        cacheWriteTokens: usage.cache_creation_input_tokens ?? 0,
      },
    })
    .catch((e) => console.error("Could not record AI usage", e));
}
