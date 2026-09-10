export const DEFAULT_BAR_WEIGHT_KG = 20;
export const DEFAULT_AVAILABLE_PLATES_KG = [25, 20, 15, 10, 5, 2.5, 1.25];

/** Greedy plate breakdown per side of the bar for a target total weight. */
export function calculatePlatesPerSide(
  targetWeightKg: number,
  barWeightKg: number = DEFAULT_BAR_WEIGHT_KG,
  availablePlatesKg: number[] = DEFAULT_AVAILABLE_PLATES_KG
): number[] {
  let remaining = (targetWeightKg - barWeightKg) / 2;
  if (remaining <= 0) return [];
  const plates: number[] = [];
  for (const plate of availablePlatesKg) {
    while (remaining >= plate - 0.001) {
      plates.push(plate);
      remaining -= plate;
    }
  }
  return plates;
}
