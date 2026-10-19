/** Reads workout history exported from Strong or Hevy (CSV) into sessions of sets. Pure
 * parsing — matching exercises and writing to the database happens in the import route. */

export interface ImportedSet {
  exerciseName: string;
  weight: number;
  reps: number;
  rpe?: number;
  isWarmup: boolean;
}

export interface ImportedSession {
  date: Date;
  name: string;
  sets: ImportedSet[];
}

const KG_PER_LB = 0.45359237;

/** RFC-4180-ish CSV: quoted fields, escaped quotes, commas or semicolons, CRLF. */
export function parseCsv(text: string): string[][] {
  const firstLine = text.split(/\r?\n/, 1)[0] ?? "";
  const delimiter = (firstLine.match(/;/g)?.length ?? 0) > (firstLine.match(/,/g)?.length ?? 0) ? ";" : ",";
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;
  const src = text.replace(/^﻿/, "");
  for (let i = 0; i < src.length; i++) {
    const c = src[i];
    if (quoted) {
      if (c === '"' && src[i + 1] === '"') {
        field += '"';
        i++;
      } else if (c === '"') quoted = false;
      else field += c;
    } else if (c === '"') quoted = true;
    else if (c === delimiter) {
      row.push(field);
      field = "";
    } else if (c === "\n" || c === "\r") {
      if (c === "\r" && src[i + 1] === "\n") i++;
      row.push(field);
      field = "";
      if (row.some((f) => f.trim() !== "")) rows.push(row);
      row = [];
    } else field += c;
  }
  row.push(field);
  if (row.some((f) => f.trim() !== "")) rows.push(row);
  return rows;
}

const MONTHS: Record<string, number> = { jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5, jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11 };

/** Dates as Strong ("2024-03-05 18:30:00") and Hevy ("5 Mar 2024, 18:30") write them. The
 * exports carry no timezone, so they are read as the user's local time (tz = minutes west of UTC). */
export function parseFlexibleDate(raw: string, tz: number): Date | null {
  const s = raw.trim();
  let m = s.match(/^(\d{4})-(\d{2})-(\d{2})(?:[T ](\d{2}):(\d{2})(?::(\d{2}))?)?/);
  if (m) return new Date(Date.UTC(+m[1], +m[2] - 1, +m[3], +(m[4] ?? 12), +(m[5] ?? 0), +(m[6] ?? 0)) + tz * 60_000);
  m = s.match(/^(\d{1,2}) ([A-Za-z]{3})[a-z]* (\d{4})(?:,? (\d{1,2}):(\d{2}))?/);
  if (m && MONTHS[m[2].toLowerCase()] !== undefined) {
    return new Date(Date.UTC(+m[3], MONTHS[m[2].toLowerCase()], +m[1], +(m[4] ?? 12), +(m[5] ?? 0)) + tz * 60_000);
  }
  m = s.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})(?:,? (\d{1,2}):(\d{2}))?/);
  if (m) return new Date(Date.UTC(+m[3], +m[2] - 1, +m[1], +(m[4] ?? 12), +(m[5] ?? 0)) + tz * 60_000);
  return null;
}

const num = (v: string | undefined): number | null => {
  if (v === undefined) return null;
  const n = Number(v.trim().replace(",", "."));
  return v.trim() !== "" && Number.isFinite(n) ? n : null;
};

function findColumn(header: string[], candidates: string[]): number {
  const norm = header.map((h) => h.trim().toLowerCase());
  for (const c of candidates) {
    const i = norm.findIndex((h) => h === c);
    if (i >= 0) return i;
  }
  for (const c of candidates) {
    const i = norm.findIndex((h) => h.startsWith(c));
    if (i >= 0) return i;
  }
  return -1;
}

export interface ParseResult {
  sessions: ImportedSession[];
  skippedRows: number;
  error?: string;
}

/** `unit` is only used when the file doesn't say (Strong exports in whatever unit the app was set to). */
export function parseWorkoutCsv(text: string, tz: number, unit: "kg" | "lbs" = "kg"): ParseResult {
  const rows = parseCsv(text);
  if (rows.length < 2) return { sessions: [], skippedRows: 0, error: "Het bestand lijkt leeg." };
  const header = rows[0];
  const col = {
    date: findColumn(header, ["date", "start_time", "datum", "start time"]),
    name: findColumn(header, ["workout name", "title", "workout_name", "workout"]),
    exercise: findColumn(header, ["exercise name", "exercise_title", "exercise"]),
    weight: findColumn(header, ["weight_kg", "weight (kg)", "weight_lbs", "weight (lbs)", "weight"]),
    reps: findColumn(header, ["reps", "repetitions"]),
    rpe: findColumn(header, ["rpe"]),
    setType: findColumn(header, ["set_type", "set type"]),
  };
  if (col.date < 0 || col.exercise < 0 || col.reps < 0) {
    return { sessions: [], skippedRows: 0, error: "Dit herken ik niet als een Strong- of Hevy-export (kolommen date, exercise en reps ontbreken)." };
  }
  const headerWeight = header[col.weight]?.toLowerCase() ?? "";
  const lbs = headerWeight.includes("lb") || (!headerWeight.includes("kg") && unit === "lbs");

  const sessions = new Map<string, ImportedSession>();
  let skipped = 0;
  for (const r of rows.slice(1)) {
    const date = parseFlexibleDate(r[col.date] ?? "", tz);
    const exerciseName = (r[col.exercise] ?? "").trim();
    const reps = num(r[col.reps]);
    const weightRaw = col.weight >= 0 ? num(r[col.weight]) : 0;
    if (!date || !exerciseName || reps === null || reps <= 0 || weightRaw === null) {
      skipped++;
      continue;
    }
    const weight = Math.round((lbs ? weightRaw * KG_PER_LB : weightRaw) * 100) / 100;
    const name = (col.name >= 0 ? r[col.name] : "")?.trim() || "Import";
    const key = `${date.getTime()}|${name}`;
    const session = sessions.get(key) ?? { date, name, sets: [] };
    const rpe = col.rpe >= 0 ? num(r[col.rpe]) : null;
    session.sets.push({
      exerciseName,
      weight,
      reps: Math.round(reps),
      rpe: rpe !== null && rpe >= 1 && rpe <= 10 ? rpe : undefined,
      isWarmup: col.setType >= 0 && /warm/i.test(r[col.setType] ?? ""),
    });
    sessions.set(key, session);
  }
  return { sessions: [...sessions.values()].sort((a, b) => a.date.getTime() - b.date.getTime()), skippedRows: skipped };
}

// ---- exercise name matching ----

const ALIASES: Record<string, string> = {
  "bench press": "Bankdrukken",
  "incline bench press": "Schuine bankdrukken",
  "decline bench press": "Decline bankdrukken",
  "chest press": "Chest press machine",
  "overhead press": "Overhead press",
  "shoulder press": "Dumbbell shoulder press",
  squat: "Squat",
  "front squat": "Front squat",
  deadlift: "Deadlift",
  "romanian deadlift": "Romanian deadlift",
  "sumo deadlift": "Sumo deadlift",
  "bent over row": "Bent-over row",
  "bent-over row": "Bent-over row",
  "dumbbell row": "Dumbbell row",
  "seated cable row": "Kabelroeien zittend",
  "seated row": "Kabelroeien zittend",
  "lat pulldown": "Lat pulldown",
  "pull up": "Optrekken",
  "pull-up": "Optrekken",
  "chin up": "Optrekken (ondergrepen)",
  "lateral raise": "Lateral raise",
  "side lateral raise": "Lateral raise",
  "face pull": "Face pull",
  "reverse fly": "Reverse fly",
  "bicep curl": "Dumbbell curl",
  "biceps curl": "Dumbbell curl",
  "hammer curl": "Hammer curl",
  "triceps pushdown": "Triceps pushdown",
  "tricep pushdown": "Triceps pushdown",
  "triceps extension": "Overhead triceps extension",
  "skull crusher": "Skull crusher",
  "leg press": "Beenpers",
  "leg extension": "Beenstrekker",
  "seated leg curl": "Beenbuiger zittend",
  "lying leg curl": "Beenbuiger liggend",
  "hip thrust": "Hip thrust",
  "calf raise": "Kuitheffen staand",
  "standing calf raise": "Kuitheffen staand",
  "seated calf raise": "Kuitheffen zittend",
  "chest fly": "Dumbbell fly",
  "push up": "Push-up",
  "push-up": "Push-up",
  plank: "Plank",
  lunge: "Lunges",
  "bulgarian split squat": "Bulgarian split squat",
  "hack squat": "Hack squat",
  shrug: "Shrugs",
};

/** "Bench Press (Barbell)" → "bench press": drop the equipment in brackets, case and extra spaces. */
export function normalizeExerciseName(name: string): string {
  return name.replace(/\(.*?\)/g, "").replace(/\s+/g, " ").trim().toLowerCase();
}

/** Our own exercise name for an imported one, if we know it. */
export function aliasFor(name: string): string | null {
  return ALIASES[normalizeExerciseName(name)] ?? null;
}

export function guessMuscleGroup(name: string): string {
  const n = name.toLowerCase();
  const has = (...w: string[]) => w.some((x) => n.includes(x));
  if (has("bench", "chest", "fly", "pec", "push-up", "push up", "dip")) return "Borst";
  if (has("lateral", "shoulder", "overhead", "delt", "face pull", "arnold", "upright")) return "Schouders";
  if (has("row", "pull", "lat ", "deadlift", "chin", "shrug", "back")) return "Rug";
  if (has("squat", "leg", "lunge", "calf", "hip", "glute", "quad", "hamstring", "step")) return "Benen";
  if (has("curl", "tricep", "bicep", "extension", "skull", "pushdown")) return "Armen";
  if (has("crunch", "plank", "ab ", "abs", "core", "sit-up", "sit up", "twist")) return "Core";
  return "Overig";
}
