/** Shoulder-to-waist ratio, the classic "V-taper" number (the golden ratio 1.618 is the
 * traditional bodybuilding ideal). Both measurements are circumferences in cm. */
export function vtaperRatio(shoulderCm: number | null | undefined, waistCm: number | null | undefined): number | null {
  if (!shoulderCm || !waistCm || shoulderCm <= 0 || waistCm <= 0) return null;
  return Math.round((shoulderCm / waistCm) * 100) / 100;
}

export const VTAPER_TARGET = 1.6;

export function vtaperLevel(ratio: number): "opbouwen" | "goed bezig" | "sterk" | "topniveau" {
  if (ratio >= 1.6) return "topniveau";
  if (ratio >= 1.45) return "sterk";
  if (ratio >= 1.3) return "goed bezig";
  return "opbouwen";
}
