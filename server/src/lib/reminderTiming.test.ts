import { describe, expect, it } from "vitest";
import { isDue, localMinutes, parseTimeOfDay } from "./reminderTiming.js";

describe("reminder timing", () => {
  it("parses times of day and rejects junk", () => {
    expect(parseTimeOfDay("17:30")).toBe(17 * 60 + 30);
    expect(parseTimeOfDay("8:05")).toBe(8 * 60 + 5);
    expect(parseTimeOfDay("25:00")).toBeNull();
    expect(parseTimeOfDay("noon")).toBeNull();
  });

  it("converts to the user's local time", () => {
    // 15:30 UTC is 17:30 in the Netherlands in summer (tz = -120)
    expect(localMinutes(new Date("2026-07-01T15:30:00Z"), -120)).toBe(17 * 60 + 30);
    expect(localMinutes(new Date("2026-07-01T23:30:00Z"), -120)).toBe(1 * 60 + 30); // wraps past midnight
  });

  it("is due from the set time for a grace window, once", () => {
    const at = 17 * 60;
    expect(isDue(at - 1, "17:00", false)).toBe(false);
    expect(isDue(at, "17:00", false)).toBe(true);
    expect(isDue(at + 89, "17:00", false)).toBe(true);
    expect(isDue(at + 90, "17:00", false)).toBe(false);
    expect(isDue(at + 5, "17:00", true)).toBe(false);
  });
});
