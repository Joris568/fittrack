import { describe, expect, it } from "vitest";
import { addItem, deriveLayout, groupIndexes, moveItem, nextInSuperset, normalizeGroups, removeItem, replaceItem, serializeLayout, toggleSuperset, workingSetCounts, type LayoutItem } from "./workoutLayout.js";

const item = (id: string, sets = 2): LayoutItem => ({ exerciseId: id, targetSets: sets, repsMin: 8, repsMax: 10 });

describe("workout layout", () => {
  it("starts from the program day order", () => {
    const layout = deriveLayout({
      layout: null,
      programDay: { exercises: [{ exerciseId: "a", targetSets: 3, targetRepsMin: 6, targetRepsMax: 8 }, { exerciseId: "b", targetSets: 2, targetRepsMin: 8, targetRepsMax: 10 }] },
      setLogs: [],
    } as never);
    expect(layout.map((i) => i.exerciseId)).toEqual(["a", "b"]);
    expect(layout[0]).toMatchObject({ targetSets: 3, repsMin: 6, repsMax: 8 });
  });

  it("prefers the saved layout and never loses an exercise that has sets", () => {
    const layout = deriveLayout({
      layout: serializeLayout([item("b"), item("a")]),
      programDay: null,
      setLogs: [{ exerciseId: "c", isWarmup: false }],
    } as never);
    expect(layout.map((i) => i.exerciseId)).toEqual(["b", "a", "c"]);
  });

  it("falls back to the program on corrupt saved data", () => {
    const layout = deriveLayout({ layout: "{nope", programDay: { exercises: [{ exerciseId: "a", targetSets: 2, targetRepsMin: 8, targetRepsMax: 10 }] }, setLogs: [] } as never);
    expect(layout.map((i) => i.exerciseId)).toEqual(["a"]);
  });

  it("moves, replaces, adds and removes without duplicates", () => {
    const base = [item("a"), item("b"), item("c")];
    expect(moveItem(base, 1, -1).map((i) => i.exerciseId)).toEqual(["b", "a", "c"]);
    expect(moveItem(base, 0, -1)).toBe(base);
    expect(moveItem(base, 2, 1)).toBe(base);
    expect(replaceItem(base, 1, "x").map((i) => i.exerciseId)).toEqual(["a", "x", "c"]);
    expect(replaceItem(base, 1, "a")).toBe(base);
    expect(addItem(base, "a")).toBe(base);
    expect(addItem(base, "d").at(-1)).toMatchObject({ exerciseId: "d", targetSets: 2, repsMin: 8, repsMax: 10 });
    expect(removeItem(base, 0).map((i) => i.exerciseId)).toEqual(["b", "c"]);
  });

  it("counts only working sets", () => {
    const m = workingSetCounts([{ exerciseId: "a", isWarmup: true }, { exerciseId: "a", isWarmup: false }, { exerciseId: "a" }]);
    expect(m.get("a")).toBe(2);
  });
});

describe("supersets", () => {
  const base = [item("a"), item("b"), item("c"), item("d")];

  it("links an exercise with the one below and splits again", () => {
    const linked = toggleSuperset(base, 1);
    expect(linked[1].groupId).toBeTruthy();
    expect(linked[1].groupId).toBe(linked[2].groupId);
    expect(linked[0].groupId).toBeFalsy();
    const split = toggleSuperset(linked, 1);
    expect(split.every((i) => !i.groupId)).toBe(true);
  });

  it("extends a superset into a triple and keeps groups contiguous when something moves", () => {
    const pair = toggleSuperset(base, 0);
    const triple = toggleSuperset(pair, 1);
    expect(triple.slice(0, 3).map((i) => i.groupId)).toEqual([triple[0].groupId, triple[0].groupId, triple[0].groupId]);
    expect(groupIndexes(triple, 2)).toEqual([0, 1, 2]);
    // moving the last member away breaks adjacency only if it leaves the run
    const moved = moveItem(pair, 0, -1);
    expect(moved).toBe(pair);
    const broken = moveItem(toggleSuperset(base, 0), 1, 1); // a,[b swapped past c] -> a alone, group dissolves
    expect(broken.every((i) => !i.groupId)).toBe(true);
  });

  it("drops a group of one (e.g. after removing a member)", () => {
    const pair = toggleSuperset(base, 0);
    expect(removeItem(pair, 1).every((i) => !i.groupId)).toBe(true);
    expect(normalizeGroups([{ ...item("x"), groupId: "g" }])[0].groupId).toBeNull();
  });

  it("alternates between the members round by round", () => {
    const pair = toggleSuperset(base, 0); // a + b
    // A did its first set: B is behind → go to B, round not complete
    expect(nextInSuperset(pair, 0, new Map([["a", 1]]))).toEqual({ next: 1, roundComplete: false });
    // B caught up: round complete → back to A
    expect(nextInSuperset(pair, 1, new Map([["a", 1], ["b", 1]]))).toEqual({ next: 0, roundComplete: true });
    // not a superset
    expect(nextInSuperset(base, 2, new Map())).toBeNull();
  });
});
