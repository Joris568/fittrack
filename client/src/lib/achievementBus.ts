import type { UnlockedAchievement } from "../api/types.js";

type Listener = (achievements: UnlockedAchievement[]) => void;
const listeners = new Set<Listener>();

export function emitAchievements(achievements?: UnlockedAchievement[] | null) {
  if (!achievements || achievements.length === 0) return;
  listeners.forEach((l) => l(achievements));
}

export function onAchievements(listener: Listener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}
