import { describe, expect, it } from "vitest";
import { shiftMonth, volumeComparison } from "./recapFun.js";

describe("recap helpers", () => {
  it("compares a lifted total to something fun, singular or plural", () => {
    expect(volumeComparison(100)).toBeNull();
    expect(volumeComparison(48_200)).toEqual({ count: 4, thing: "stadsbussen" }); // biggest thing that fits at least twice
    expect(volumeComparison(350)).toEqual({ count: 3, thing: "scooters" });
    expect(volumeComparison(1600)).toEqual({ count: 2, thing: "koeien" }); // the car fits only once (1.07), cows fit twice

  });
  it("shifts months across year ends", () => {
    expect(shiftMonth("2026-01", -1)).toBe("2025-12");
    expect(shiftMonth("2026-12", 1)).toBe("2027-01");
  });
});
