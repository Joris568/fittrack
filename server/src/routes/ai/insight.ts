import type { AiInsight } from "@prisma/client";

export function parseInsight<T>(insight: AiInsight): Omit<AiInsight, "content"> & { content: T } {
  return { ...insight, content: JSON.parse(insight.content) as T };
}
