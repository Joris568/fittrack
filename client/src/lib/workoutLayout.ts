import type { Exercise, SetLog, WorkoutSession } from "../api/types.js";

/** The exercises of one training in the order the user wants them. Starts as the program day
 * (plus anything logged outside it) and is saved on the session as soon as it is changed. */
export interface LayoutItem {
  exerciseId: string;
  targetSets: number;
  repsMin: number;
  repsMax: number;
  restSeconds?: number | null;
  targetWeight?: number | null;
}

export const DEFAULT_TARGET = { targetSets: 2, repsMin: 8, repsMax: 10 };

function parse(raw: string | null | undefined): LayoutItem[] | null {
  if (!raw) return null;
  try {
    const v = JSON.parse(raw);
    if (!Array.isArray(v?.items)) return null;
    return v.items.filter((i: LayoutItem) => i && typeof i.exerciseId === "string");
  } catch {
    return null;
  }
}

export function serializeLayout(items: LayoutItem[]): string {
  return JSON.stringify({ items });
}

/** Saved layout, else the program day's order; exercises that already have sets are always
 * part of it so nothing logged can vanish. */
export function deriveLayout(session: Pick<WorkoutSession, "layout" | "programDay" | "setLogs">): LayoutItem[] {
  const saved = parse(session.layout);
  const items: LayoutItem[] =
    saved ??
    (session.programDay?.exercises ?? []).map((pe) => ({
      exerciseId: pe.exerciseId,
      targetSets: pe.targetSets,
      repsMin: pe.targetRepsMin,
      repsMax: pe.targetRepsMax,
      restSeconds: pe.restSeconds,
      targetWeight: pe.targetWeight,
    }));
  const present = new Set(items.map((i) => i.exerciseId));
  for (const s of session.setLogs) {
    if (!present.has(s.exerciseId)) {
      present.add(s.exerciseId);
      items.push({ exerciseId: s.exerciseId, ...DEFAULT_TARGET });
    }
  }
  return items;
}

export function moveItem(items: LayoutItem[], index: number, delta: -1 | 1): LayoutItem[] {
  const to = index + delta;
  if (to < 0 || to >= items.length) return items;
  const next = [...items];
  [next[index], next[to]] = [next[to], next[index]];
  return next;
}

/** Swap an exercise for another one, keeping its place and its sets/reps target. Refuses when the
 * replacement is already in the training. */
export function replaceItem(items: LayoutItem[], index: number, exerciseId: string): LayoutItem[] {
  if (items.some((i, idx) => idx !== index && i.exerciseId === exerciseId)) return items;
  return items.map((it, idx) => (idx === index ? { ...it, exerciseId, targetWeight: null } : it));
}

export function addItem(items: LayoutItem[], exerciseId: string): LayoutItem[] {
  if (items.some((i) => i.exerciseId === exerciseId)) return items;
  return [...items, { exerciseId, ...DEFAULT_TARGET }];
}

export function removeItem(items: LayoutItem[], index: number): LayoutItem[] {
  return items.filter((_, i) => i !== index);
}

/** Working (non-warm-up) sets per exercise id. */
export function workingSetCounts(sets: Pick<SetLog, "exerciseId" | "isWarmup">[]): Map<string, number> {
  const m = new Map<string, number>();
  for (const s of sets) if (!s.isWarmup) m.set(s.exerciseId, (m.get(s.exerciseId) ?? 0) + 1);
  return m;
}

export type { Exercise };
