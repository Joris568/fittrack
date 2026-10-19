import { describe, expect, it } from "vitest";
import { suggestNext, weightStep } from "./progression.js";

describe("double progression", () => {
  it("adds weight once every set hit the top of the range", () => {
    const s = suggestNext([{ weight: 80, reps: 10 }, { weight: 80, reps: 10 }], 8, 10)!;
    expect(s).toMatchObject({ kind: "increase", weight: 82.5, reps: 8 });
  });

  it("keeps the weight and aims for one more rep when the top isn't reached", () => {
    const s = suggestNext([{ weight: 80, reps: 9 }, { weight: 80, reps: 8 }], 8, 10)!;
    expect(s).toMatchObject({ kind: "push", weight: 80, reps: 9 });
  });

  it("doesn't add weight after an all-out (RPE 10) top set", () => {
    const s = suggestNext([{ weight: 80, reps: 10, rpe: 10 }, { weight: 80, reps: 10, rpe: 10 }], 8, 10)!;
    expect(s.kind).toBe("hold");
    expect(s.weight).toBe(80);
  });

  it("goes back down when reps fell well below the range", () => {
    const s = suggestNext([{ weight: 100, reps: 5 }], 8, 10)!;
    expect(s).toMatchObject({ kind: "reduce", weight: 97.5 });
  });

  it("looks only at the heaviest weight, ignoring lighter back-off sets", () => {
    const s = suggestNext([{ weight: 80, reps: 10 }, { weight: 60, reps: 12 }], 8, 10)!;
    expect(s.kind).toBe("increase");
  });

  it("uses the rating of last session: too easy steps up one rep early, crushed holds", () => {
    const nearTop = [{ weight: 80, reps: 9 }, { weight: 80, reps: 9 }];
    expect(suggestNext(nearTop, 8, 10)!.kind).toBe("push");
    expect(suggestNext(nearTop, 8, 10, 1)!.kind).toBe("increase");
    const top = [{ weight: 80, reps: 10 }, { weight: 80, reps: 10 }];
    expect(suggestNext(top, 8, 10, 3)!.kind).not.toBe("increase");
  });

  it("returns nothing without history; steps scale with the weight", () => {
    expect(suggestNext([], 8, 10)).toBeNull();
    expect(weightStep(10)).toBe(1);
    expect(weightStep(60)).toBe(2.5);
    expect(weightStep(150)).toBe(5);
  });
});
