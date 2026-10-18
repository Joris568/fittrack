export interface PastSet {
  weight: number;
  reps: number;
  rpe?: number | null;
}

export interface Suggestion {
  kind: "increase" | "push" | "hold" | "reduce";
  weight: number;
  reps: number;
  text: string;
}

/** Smallest sensible step up for a given working weight. */
export function weightStep(weight: number): number {
  if (weight < 20) return 1;
  if (weight >= 140) return 5;
  return 2.5;
}

const round = (n: number) => Math.round(n * 100) / 100;

/** Double progression on the previous session's sets: once every set at the top weight hits
 * the top of the rep range (and wasn't an all-out grind), add weight and restart at the
 * bottom; otherwise keep the weight and aim for one more rep. */
export function suggestNext(lastSets: PastSet[], repsMin: number, repsMax: number): Suggestion | null {
  if (lastSets.length === 0 || repsMax < repsMin) return null;
  const top = Math.max(...lastSets.map((s) => s.weight));
  const atTop = lastSets.filter((s) => s.weight === top);
  const minReps = Math.min(...atTop.map((s) => s.reps));
  const maxReps = Math.max(...atTop.map((s) => s.reps));
  const grind = atTop.some((s) => s.rpe != null && s.rpe >= 10);
  const step = weightStep(top);

  if (minReps >= repsMax && !grind) {
    return {
      kind: "increase",
      weight: round(top + step),
      reps: repsMin,
      text: `Alle sets op ${repsMax}+ reps: verhoog naar ${round(top + step)} kg en mik op ${repsMin}-${repsMax}.`,
    };
  }
  if (maxReps < repsMin - 1) {
    return {
      kind: "reduce",
      weight: round(Math.max(0, top - step)),
      reps: repsMin,
      text: `Vorige keer bleef je onder ${repsMin} reps: ga terug naar ${round(Math.max(0, top - step))} kg en bouw weer op.`,
    };
  }
  const target = Math.min(repsMax, Math.max(minReps + 1, repsMin));
  return {
    kind: minReps >= repsMax ? "hold" : "push",
    weight: top,
    reps: target,
    text:
      minReps >= repsMax
        ? `Je zat op de top van het bereik maar met veel inspanning: blijf op ${top} kg en maak het strakker.`
        : `Blijf op ${top} kg en mik op ${target} reps per set (vorige keer ${minReps}-${maxReps}).`,
  };
}
