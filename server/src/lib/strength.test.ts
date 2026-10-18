import { describe, expect, it } from "vitest";
import { estimate1RM, isPersonalRecord } from "./strength.js";

describe("personal records", () => {
  it("the first ever set is a baseline, not a record", () => {
    expect(isPersonalRecord([], { weight: 100, reps: 8 })).toBe(false);
  });

  it("a heavier weight is a record", () => {
    expect(isPersonalRecord([{ weight: 100, reps: 8 }], { weight: 105, reps: 8 })).toBe(true);
  });

  it("more reps at the same weight is a record (the old weight-only rule missed this)", () => {
    expect(isPersonalRecord([{ weight: 100, reps: 8 }], { weight: 100, reps: 10 })).toBe(true);
  });

  it("equal or worse is not a record", () => {
    expect(isPersonalRecord([{ weight: 100, reps: 8 }], { weight: 100, reps: 8 })).toBe(false);
    expect(isPersonalRecord([{ weight: 100, reps: 8 }], { weight: 90, reps: 8 })).toBe(false);
  });

  it("a very high-rep set doesn't beat a heavy set through the formula's blind spot", () => {
    expect(isPersonalRecord([{ weight: 100, reps: 5 }], { weight: 40, reps: 40 })).toBe(false);
    expect(estimate1RM(100, 1)).toBe(100);
    expect(estimate1RM(0, 10)).toBe(0);
  });
});
