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
  /** Exercises sharing a groupId are a superset: done in rounds, with no rest between them. */
  groupId?: string | null;
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

/** A superset must be 2+ exercises sitting next to each other; anything else loses its group. */
export function normalizeGroups(items: LayoutItem[]): LayoutItem[] {
  const out = items.map((i) => ({ ...i }));
  let start = 0;
  while (start < out.length) {
    const gid = out[start].groupId;
    let end = start;
    while (end + 1 < out.length && gid && out[end + 1].groupId === gid) end++;
    if (gid && end === start) out[start].groupId = null;
    start = end + 1;
  }
  // the same id reused by two separate runs: keep the first, clear the rest
  const seen = new Set<string>();
  for (let i = 0; i < out.length; i++) {
    const gid = out[i].groupId;
    if (!gid) continue;
    const isRunStart = i === 0 || out[i - 1].groupId !== gid;
    if (isRunStart) {
      if (seen.has(gid)) {
        let j = i;
        while (j < out.length && out[j].groupId === gid) out[j++].groupId = null;
      } else seen.add(gid);
    }
  }
  return out;
}

export function moveItem(items: LayoutItem[], index: number, delta: -1 | 1): LayoutItem[] {
  const to = index + delta;
  if (to < 0 || to >= items.length) return items;
  const next = [...items];
  [next[index], next[to]] = [next[to], next[index]];
  return normalizeGroups(next);
}

/** Link an exercise with the one below it as a superset, or split them again if already linked. */
export function toggleSuperset(items: LayoutItem[], index: number): LayoutItem[] {
  if (index < 0 || index >= items.length - 1) return items;
  const a = items[index];
  const b = items[index + 1];
  if (a.groupId && a.groupId === b.groupId) {
    // split: everything from the lower exercise onwards in this run gets its own group (or none)
    const gid = a.groupId;
    const next = items.map((i) => ({ ...i }));
    let j = index + 1;
    const newId = `g${Date.now().toString(36)}`;
    while (j < next.length && next[j].groupId === gid) next[j++].groupId = newId;
    return normalizeGroups(next);
  }
  const gid = a.groupId ?? b.groupId ?? `g${Date.now().toString(36)}${index}`;
  const next = items.map((i) => ({ ...i }));
  next[index].groupId = gid;
  next[index + 1].groupId = gid;
  // merge a neighbouring run into the same group
  for (const [from, step] of [[index - 1, -1], [index + 2, 1]] as const) {
    let k = from;
    const old = items[k]?.groupId;
    while (old && k >= 0 && k < next.length && next[k].groupId === old) {
      next[k].groupId = gid;
      k += step;
    }
  }
  return normalizeGroups(next);
}

/** Members (indexes, in order) of the superset the item belongs to, or just itself. */
export function groupIndexes(items: LayoutItem[], index: number): number[] {
  const gid = items[index]?.groupId;
  if (!gid) return [index];
  return items.map((i, idx) => (i.groupId === gid ? idx : -1)).filter((i) => i >= 0);
}

/** After a set in a superset: which member comes next, and whether the round is complete.
 * `counts` are working sets per exercise id INCLUDING the set just logged. */
export function nextInSuperset(items: LayoutItem[], index: number, counts: Map<string, number>): { next: number; roundComplete: boolean } | null {
  const members = groupIndexes(items, index);
  if (members.length < 2) return null;
  const done = (m: number) => counts.get(items[m].exerciseId) ?? 0;
  const mine = done(index);
  const behind = members.filter((m) => m !== index && done(m) < mine);
  if (behind.length > 0) {
    const pos = members.indexOf(index);
    const ordered = [...members.slice(pos + 1), ...members.slice(0, pos)];
    return { next: ordered.find((m) => behind.includes(m))!, roundComplete: false };
  }
  return { next: members[0], roundComplete: true };
}

/** Swap an exercise for another one, keeping its place and its sets/reps target. Refuses when the
 * replacement is already in the training. */
export function replaceItem(items: LayoutItem[], index: number, exerciseId: string): LayoutItem[] {
  if (items.some((i, idx) => idx !== index && i.exerciseId === exerciseId)) return items;
  return normalizeGroups(items.map((it, idx) => (idx === index ? { ...it, exerciseId, targetWeight: null } : it)));
}

export function addItem(items: LayoutItem[], exerciseId: string): LayoutItem[] {
  if (items.some((i) => i.exerciseId === exerciseId)) return items;
  return [...items, { exerciseId, ...DEFAULT_TARGET }];
}

export function removeItem(items: LayoutItem[], index: number): LayoutItem[] {
  return normalizeGroups(items.filter((_, i) => i !== index));
}

/** Working (non-warm-up) sets per exercise id. */
export function workingSetCounts(sets: Pick<SetLog, "exerciseId" | "isWarmup">[]): Map<string, number> {
  const m = new Map<string, number>();
  for (const s of sets) if (!s.isWarmup) m.set(s.exerciseId, (m.get(s.exerciseId) ?? 0) + 1);
  return m;
}

export type { Exercise };
