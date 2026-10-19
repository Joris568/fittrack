import { describe, expect, it } from "vitest";
import { countHardWeeks, deloadSignal, evaluateWeeklyCheckin } from "./weeklyCheckin.js";

const base = { goal: "bulk" as const, weightKg: 80, weighIns: 6, weighSpanDays: 13, loggedDays: 10, currentCalories: 3000 };

describe("weekly check-in", () => {
  it("leaves a bulk alone when the pace is in range (0.2-0.5%/week of 80 kg = 0.16-0.4 kg)", () => {
    const r = evaluateWeeklyCheckin({ ...base, ratePerWeek: 0.3 });
    expect(r.status).toBe("op-schema");
    expect(r.deltaKcal).toBe(0);
    expect(r.newCalories).toBe(3000);
  });

  it("adds calories when a bulk is too slow, capped at 200", () => {
    const r = evaluateWeeklyCheckin({ ...base, ratePerWeek: 0 });
    expect(r.status).toBe("te-langzaam");
    expect(r.deltaKcal).toBeGreaterThan(0);
    expect(r.deltaKcal).toBeLessThanOrEqual(200);
    expect(r.newCalories).toBe(3000 + r.deltaKcal);
  });

  it("removes calories when a bulk is too fast", () => {
    const r = evaluateWeeklyCheckin({ ...base, ratePerWeek: 0.9 });
    expect(r.status).toBe("te-snel");
    expect(r.deltaKcal).toBeLessThan(0);
  });

  it("a cut that loses too much too fast gets calories back; too slow gets fewer", () => {
    const fast = evaluateWeeklyCheckin({ ...base, goal: "cut", ratePerWeek: -1.2, currentCalories: 2400 });
    expect(fast.deltaKcal).toBeGreaterThan(0);
    const slow = evaluateWeeklyCheckin({ ...base, goal: "cut", ratePerWeek: -0.1, currentCalories: 2400 });
    expect(slow.deltaKcal).toBeLessThan(0);
  });

  it("refuses to advise on thin data", () => {
    expect(evaluateWeeklyCheckin({ ...base, ratePerWeek: 0.3, weighIns: 2 }).status).toBe("te-weinig-data");
    expect(evaluateWeeklyCheckin({ ...base, ratePerWeek: 0.3, loggedDays: 3 }).status).toBe("te-weinig-data");
    expect(evaluateWeeklyCheckin({ ...base, ratePerWeek: null }).status).toBe("te-weinig-data");
    expect(evaluateWeeklyCheckin({ ...base, ratePerWeek: 0.3, weighSpanDays: 4 }).status).toBe("te-weinig-data");
  });
});

describe("deload signal", () => {
  it("needs two kinds of evidence", () => {
    expect(deloadSignal({ plateauCount: 3, hardWeeks: 2, lowReadiness: 0 }).suggested).toBe(false);
    expect(deloadSignal({ plateauCount: 3, hardWeeks: 5, lowReadiness: 0 }).suggested).toBe(true);
    expect(deloadSignal({ plateauCount: 0, hardWeeks: 8, lowReadiness: 2 }).suggested).toBe(true);
    expect(deloadSignal({ plateauCount: 0, hardWeeks: 3, lowReadiness: 0 }).reasons).toEqual([]);
  });

  it("counts consecutive hard weeks and ignores an unfinished current week", () => {
    expect(countHardWeeks([1, 3, 3, 2, 0, 3])).toBe(3); // this week has just 1 so far, then 3 hard weeks
    expect(countHardWeeks([3, 3, 1, 3])).toBe(2);
    expect(countHardWeeks([0, 0, 0])).toBe(0);
  });
});
