import { describe, expect, it } from "vitest";
import { bmr, estimateMeasuredTdee, formulaTdee, linearSlope, movingAverage, suggestGoal } from "./nutritionCalc.js";

describe("nutrition calculations", () => {
  it("Mifflin-St Jeor matches a known example (male, 80kg, 180cm, 25y)", () => {
    expect(bmr("male", 80, 180, 25)).toBe(1805);
    expect(bmr("female", 60, 165, 30)).toBeCloseTo(1320.25, 2);
    expect(formulaTdee("male", 80, 180, 25, "moderate")).toBe(Math.round(1805 * 1.55));
  });

  it("goal suggestion: surplus for bulk, deficit for cut, macros add up", () => {
    const bulk = suggestGoal(2800, "bulk", 80);
    expect(bulk.calories).toBe(3100);
    expect(bulk.proteinGrams).toBe(160);
    expect(bulk.fatGrams).toBe(72);
    const kcal = bulk.proteinGrams * 4 + bulk.carbsGrams * 4 + bulk.fatGrams * 9;
    expect(Math.abs(kcal - bulk.calories)).toBeLessThanOrEqual(4);
    const cut = suggestGoal(2800, "cut", 80);
    expect(cut.calories).toBe(2400);
    expect(cut.proteinGrams).toBe(176);
  });

  it("slope and moving average", () => {
    expect(linearSlope([{ x: 0, y: 0 }, { x: 10, y: 5 }])).toBe(0.5);
    expect(linearSlope([{ x: 1, y: 3 }])).toBeNull();
    expect(movingAverage([1, 2, 3, 4], 2)).toEqual([1, 1.5, 2.5, 3.5]);
  });

  it("measured TDEE: eating 3000 while gaining 0.25 kg/week → maintenance ≈ 2725", () => {
    const kcal = Array(20).fill(3000);
    const weights = [0, 7, 14, 21, 28].map((day) => ({ day, kg: 80 + (day / 7) * 0.25 }));
    const r = estimateMeasuredTdee(kcal, weights)!;
    expect(r.kgPerWeek).toBe(0.25);
    expect(r.tdee).toBe(Math.round(3000 - (0.25 / 7) * 7700));
  });

  it("refuses to guess with too little data", () => {
    expect(estimateMeasuredTdee(Array(5).fill(3000), [{ day: 0, kg: 80 }, { day: 20, kg: 81 }])).toBeNull();
    expect(estimateMeasuredTdee(Array(12).fill(3000), [0, 3, 6, 9].map((day) => ({ day, kg: 80 })))).toBeNull(); // span < 14
  });
});
