import { describe, expect, it } from "vitest";
import { levelFromXp, levelTitle, questProgress, xpThreshold } from "./xp.js";

describe("levels", () => {
  it("level 1 starts at 0 XP and thresholds only go up", () => {
    expect(xpThreshold(1)).toBe(0);
    for (let l = 1; l < 40; l++) expect(xpThreshold(l + 1)).toBeGreaterThan(xpThreshold(l));
  });

  it("derives the level and the bounds of the current level from XP", () => {
    expect(levelFromXp(0).level).toBe(1);
    const at = xpThreshold(5);
    expect(levelFromXp(at).level).toBe(5);
    expect(levelFromXp(at - 1).level).toBe(4);
    expect(levelFromXp(at + 1)).toMatchObject({ level: 5, currentLevelXp: at, nextLevelXp: xpThreshold(6) });
  });

  it("titles escalate", () => {
    expect(levelTitle(1)).toBe("Rookie");
    expect(levelTitle(30)).toBe("Legende");
  });
});

describe("weekly quests", () => {
  it("caps progress at the target and flags done", () => {
    const q = questProgress({ sessions: 6, proteinDays: 1, foodDays: 5, prs: 0 });
    expect(q.find((x) => x.key === "sessions")).toMatchObject({ progress: 4, done: true });
    expect(q.find((x) => x.key === "proteinDays")).toMatchObject({ progress: 1, done: false });
    expect(q.find((x) => x.key === "foodDays")?.done).toBe(true);
  });
});
