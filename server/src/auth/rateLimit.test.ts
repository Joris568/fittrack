import { describe, expect, it } from "vitest";
import { clearLoginFailures, loginBlockedForMs, recordLoginFailure } from "./rateLimit.js";

describe("login rate limit", () => {
  it("blocks after 8 failures, then releases after the window", () => {
    const ip = "1.2.3.4";
    const t0 = 1_000_000;
    for (let i = 0; i < 7; i++) recordLoginFailure(ip, t0);
    expect(loginBlockedForMs(ip, t0)).toBe(0);
    recordLoginFailure(ip, t0);
    expect(loginBlockedForMs(ip, t0)).toBeGreaterThan(0);
    expect(loginBlockedForMs(ip, t0 + 16 * 60_000)).toBe(0);
  });

  it("a success clears the counter and other IPs are unaffected", () => {
    for (let i = 0; i < 8; i++) recordLoginFailure("9.9.9.9", 5);
    expect(loginBlockedForMs("8.8.8.8", 5)).toBe(0);
    clearLoginFailures("9.9.9.9");
    expect(loginBlockedForMs("9.9.9.9", 5)).toBe(0);
  });
});
