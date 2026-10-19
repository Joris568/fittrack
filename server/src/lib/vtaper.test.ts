import { describe, expect, it } from "vitest";
import { vtaperLevel, vtaperRatio } from "./vtaper.js";

describe("v-taper ratio", () => {
  it("divides shoulders by waist and refuses incomplete input", () => {
    expect(vtaperRatio(120, 80)).toBe(1.5);
    expect(vtaperRatio(120, null)).toBeNull();
    expect(vtaperRatio(undefined, 80)).toBeNull();
    expect(vtaperRatio(0, 80)).toBeNull();
  });
  it("labels the level", () => {
    expect(vtaperLevel(1.2)).toBe("opbouwen");
    expect(vtaperLevel(1.35)).toBe("goed bezig");
    expect(vtaperLevel(1.5)).toBe("sterk");
    expect(vtaperLevel(1.62)).toBe("topniveau");
  });
});
