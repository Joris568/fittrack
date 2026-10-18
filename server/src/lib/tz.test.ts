import { describe, expect, it } from "vitest";
import { addDaysKey, dayKeyOf, dayRange, toDayKey, weekStartKey } from "./tz.js";

// Netherlands in winter = UTC+1 → getTimezoneOffset() = -60; summer = -120.
describe("timezone day grouping", () => {
  it("puts a 00:30 Dutch meal on the Dutch day, not the UTC day before", () => {
    const loggedAt = new Date("2026-10-17T22:30:00Z"); // 00:30 on the 18th in NL (UTC+2)
    expect(dayKeyOf(loggedAt, -120)).toBe("2026-10-18");
    expect(dayKeyOf(loggedAt, 0)).toBe("2026-10-17");
  });

  it("day range covers exactly the local day", () => {
    const { start, end } = dayRange("2026-10-18", -120);
    expect(start.toISOString()).toBe("2026-10-17T22:00:00.000Z");
    expect(end.toISOString()).toBe("2026-10-18T22:00:00.000Z");
    expect(dayKeyOf(new Date(start.getTime()), -120)).toBe("2026-10-18");
    expect(dayKeyOf(new Date(end.getTime() - 1), -120)).toBe("2026-10-18");
    expect(dayKeyOf(end, -120)).toBe("2026-10-19");
  });

  it("week starts on Monday and day math crosses month ends", () => {
    expect(weekStartKey("2026-10-18")).toBe("2026-10-12"); // Sunday → previous Monday
    expect(weekStartKey("2026-10-12")).toBe("2026-10-12");
    expect(addDaysKey("2026-10-31", 1)).toBe("2026-11-01");
    expect(addDaysKey("2026-03-01", -1)).toBe("2026-02-28");
  });

  it("accepts a day key or an ISO timestamp", () => {
    expect(toDayKey("2026-10-18", -120)).toBe("2026-10-18");
    expect(toDayKey("2026-10-17T22:30:00.000Z", -120)).toBe("2026-10-18");
    expect(toDayKey("nonsense", 0)).toBeNull();
    expect(toDayKey(undefined, 0)).toBeNull();
  });
});
