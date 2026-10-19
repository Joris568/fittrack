import type { Goal } from "./nutritionCalc.js";

/** Healthy pace in % of bodyweight per week for each goal (matches the dashboard badge). */
export const TARGET_RANGE_PCT: Record<Goal, [number, number]> = {
  bulk: [0.2, 0.5],
  cut: [-1, -0.4],
  maintain: [-0.2, 0.2],
};

export interface CheckinInput {
  goal: Goal;
  weightKg: number;
  /** kg per week from the last two weeks of weigh-ins */
  ratePerWeek: number | null;
  weighIns: number;
  weighSpanDays: number;
  loggedDays: number;
  currentCalories: number;
}

export interface CheckinResult {
  status: "op-schema" | "te-langzaam" | "te-snel" | "te-weinig-data";
  ratePerWeek: number | null;
  ratePct: number | null;
  targetRangePct: [number, number];
  /** kcal per day to add (positive) or remove (negative); 0 when on pace or unknown */
  deltaKcal: number;
  newCalories: number;
  text: string;
}

const KCAL_PER_KG = 7700;

/** The weekly "how are we doing" call, the way a coach would make it: compare the real weight
 * trend with the pace for the goal and nudge calories by a modest amount (never more than
 * ±200 kcal in one step), or say there isn't enough data yet. */
export function evaluateWeeklyCheckin(i: CheckinInput): CheckinResult {
  const range = TARGET_RANGE_PCT[i.goal];
  const base = { targetRangePct: range, deltaKcal: 0, newCalories: i.currentCalories, ratePerWeek: i.ratePerWeek, ratePct: null as number | null };

  if (i.ratePerWeek === null || i.weighIns < 3 || i.weighSpanDays < 7 || i.loggedDays < 5) {
    return { ...base, status: "te-weinig-data", text: "Nog te weinig data voor een eerlijke check. Weeg jezelf een paar keer per week en log je eten, dan krijg je hier een advies." };
  }

  const ratePct = (i.ratePerWeek / i.weightKg) * 100;
  const mid = (range[0] + range[1]) / 2;
  const withPct = { ...base, ratePct: Math.round(ratePct * 100) / 100 };

  if (ratePct >= range[0] && ratePct <= range[1]) {
    return { ...withPct, status: "op-schema", text: `Je zit op schema: ${fmt(i.ratePerWeek)} kg per week (${fmt(ratePct)}%). Niks aan veranderen, gewoon doorgaan.` };
  }

  const wantedChangeKgPerWeek = (mid / 100) * i.weightKg - i.ratePerWeek;
  const rawKcal = (wantedChangeKgPerWeek * KCAL_PER_KG) / 7;
  const deltaKcal = Math.round(Math.max(-200, Math.min(200, rawKcal)) / 10) * 10;
  const tooSlow = ratePct < range[0];
  const verb = deltaKcal >= 0 ? "erbij" : "eraf";
  const status = (i.goal === "cut" ? !tooSlow : tooSlow) ? "te-langzaam" : "te-snel";
  const word = i.goal === "cut" ? (tooSlow ? "te snel af" : "te langzaam af") : tooSlow ? "te langzaam aan" : "te snel aan";
  // a bulk where the scale is going down, or a cut where it goes up, deserves plain words
  const wrongWay = (i.goal === "bulk" && i.ratePerWeek < 0) || (i.goal === "cut" && i.ratePerWeek > 0);
  if (wrongWay) {
    return {
      ...withPct,
      status,
      deltaKcal,
      newCalories: i.currentCalories + deltaKcal,
      text: `Je gewicht gaat de verkeerde kant op: ${fmt(i.ratePerWeek)} kg per week, terwijl je wilt ${i.goal === "bulk" ? "opbouwen" : "afvallen"}. Voorstel: ${Math.abs(deltaKcal)} kcal per dag ${deltaKcal >= 0 ? "erbij" : "eraf"}.`,
    };
  }
  return {
    ...withPct,
    status,
    deltaKcal,
    newCalories: i.currentCalories + deltaKcal,
    text: `Je neemt ${word}: ${fmt(i.ratePerWeek)} kg per week (${fmt(ratePct)}%), terwijl ${range[0]} tot ${range[1]}% past bij jouw doel. Voorstel: ${Math.abs(deltaKcal)} kcal per dag ${verb}.`,
  };
}

function fmt(n: number): string {
  return `${n > 0 ? "+" : ""}${Math.round(n * 100) / 100}`;
}

// ---------------- deload ----------------

export interface DeloadInput {
  plateauCount: number;
  /** consecutive weeks (ending now) with at least 2 sessions, without a lighter week */
  hardWeeks: number;
  /** of the last few sessions that had a readiness check, how many were low */
  lowReadiness: number;
}

export interface DeloadSignal {
  suggested: boolean;
  score: number;
  reasons: string[];
}

/** Rule-of-thumb fatigue check: stalled lifts, many weeks in a row without a lighter week, and
 * repeated low readiness. Needs two kinds of evidence (score >= 3) before suggesting a deload. */
export function deloadSignal(i: DeloadInput): DeloadSignal {
  let score = 0;
  const reasons: string[] = [];
  if (i.plateauCount >= 3) {
    score += 2;
    reasons.push(`${i.plateauCount} oefeningen staan al 3 trainingen stil`);
  } else if (i.plateauCount === 2) {
    score += 1;
    reasons.push("2 oefeningen staan al 3 trainingen stil");
  }
  if (i.hardWeeks >= 7) {
    score += 2;
    reasons.push(`${i.hardWeeks} weken achter elkaar zonder rustigere week`);
  } else if (i.hardWeeks >= 5) {
    score += 1;
    reasons.push(`${i.hardWeeks} weken achter elkaar zonder rustigere week`);
  }
  if (i.lowReadiness >= 2) {
    score += 2;
    reasons.push("je voelde je meerdere keren slecht hersteld voor een training");
  }
  return { suggested: score >= 3, score, reasons };
}

/** Consecutive weeks (newest first, week index 0 = this week) with >= 2 sessions. */
export function countHardWeeks(sessionsPerWeekNewestFirst: number[]): number {
  let n = 0;
  for (const [idx, c] of sessionsPerWeekNewestFirst.entries()) {
    if (c >= 2) n++;
    else if (idx === 0) continue; // the current week may simply not be over yet
    else break;
  }
  return n;
}
