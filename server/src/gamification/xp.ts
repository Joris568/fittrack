/** XP, levels and weekly quests. Everything is derived from data that already exists
 * (sessions, sets, PRs, food logs, ...) so there's no extra table to keep in sync and
 * XP can never drift from what the user actually did. */

export const XP = {
  workout: 50,
  set: 3,
  pr: 25,
  foodDay: 15,
  proteinDay: 25,
  bodyMetric: 10,
  photo: 10,
  achievement: 100,
  quest: 75,
} as const;

/** Total XP needed to reach `level` (level 1 = 0). */
export function xpThreshold(level: number): number {
  return Math.round(100 * Math.pow(level - 1, 1.7));
}

export function levelFromXp(xp: number) {
  let level = 1;
  while (xp >= xpThreshold(level + 1)) level++;
  return { level, currentLevelXp: xpThreshold(level), nextLevelXp: xpThreshold(level + 1) };
}

export function levelTitle(level: number): string {
  if (level >= 25) return "Legende";
  if (level >= 18) return "Beast";
  if (level >= 12) return "Grinder";
  if (level >= 6) return "Gym rat";
  return "Rookie";
}

export interface WeekStats {
  sessions: number;
  proteinDays: number;
  foodDays: number;
  prs: number;
}

export const WEEKLY_QUESTS: { key: keyof WeekStats; title: string; target: number }[] = [
  { key: "sessions", title: "Train 4 keer", target: 4 },
  { key: "proteinDays", title: "Haal je eiwitdoel op 4 dagen", target: 4 },
  { key: "foodDays", title: "Log je eten op 5 dagen", target: 5 },
  { key: "prs", title: "Verbreek 1 record", target: 1 },
];

export function questProgress(week: WeekStats) {
  return WEEKLY_QUESTS.map((q) => ({
    key: q.key,
    title: q.title,
    target: q.target,
    progress: Math.min(week[q.key], q.target),
    done: week[q.key] >= q.target,
    xp: XP.quest,
  }));
}
