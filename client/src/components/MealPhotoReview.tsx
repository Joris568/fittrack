import { useState } from "react";
import { api } from "../api/client.js";
import { FoodLogEntry, MealPhotoAnalysis, WithAchievements } from "../api/types.js";
import { Button, Input } from "./ui.js";
import { emitAchievements } from "../lib/achievementBus.js";

/** Shows what Claude saw on the plate as an editable list — the photo only gives an
 * estimate, so every gram amount can be corrected (or an item unchecked) before logging. */
export default function MealPhotoReview({
  analysis,
  mealType,
  date,
  onAdded,
  onCancel,
}: {
  analysis: MealPhotoAnalysis;
  mealType: FoodLogEntry["mealType"];
  date: Date;
  onAdded: () => void;
  onCancel: () => void;
}) {
  const [rows, setRows] = useState(() =>
    analysis.items.map((item) => ({ item, include: true, grams: String(item.estimatedGrams) }))
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const active = rows.filter((r) => r.include && Number(r.grams) > 0);
  const totals = active.reduce(
    (t, r) => {
      const f = Number(r.grams) / 100;
      return {
        kcal: t.kcal + r.item.food.caloriesPer100g * f,
        protein: t.protein + r.item.food.proteinPer100g * f,
      };
    },
    { kcal: 0, protein: 0 }
  );

  async function logAll() {
    setSaving(true);
    setError(null);
    try {
      for (const r of active) {
        const entry = await api.post<WithAchievements>("/food/log", {
          mealType,
          quantityGrams: Number(r.grams),
          foodItem: { ...r.item.food, source: r.item.source },
          date: date.toISOString(),
        });
        emitAchievements(entry.newAchievements);
      }
      onAdded();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Toevoegen mislukt");
      setSaving(false);
    }
  }

  if (rows.length === 0) {
    return (
      <div className="space-y-2">
        <p className="text-sm text-gray-600">Ik zie geen eten op deze foto. Probeer een foto van boven, met goed licht.</p>
        <Button variant="secondary" className="w-full" onClick={onCancel}>
          Terug
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div>
        <p className="text-sm font-medium">{analysis.dishName}</p>
        <p className="text-xs text-gray-400">Geschat op basis van de foto. Pas de gewichten aan als het niet klopt.</p>
        {analysis.notes && <p className="text-xs text-amber-600 mt-1">{analysis.notes}</p>}
      </div>

      <div className="space-y-2">
        {rows.map((r, i) => {
          const kcal = Math.round((r.item.food.caloriesPer100g * Number(r.grams || 0)) / 100);
          return (
            <div key={i} className={`flex items-center gap-2 ${r.include ? "" : "opacity-40"}`}>
              <input
                type="checkbox"
                checked={r.include}
                onChange={(e) => setRows((prev) => prev.map((x, j) => (j === i ? { ...x, include: e.target.checked } : x)))}
                className="w-5 h-5 shrink-0 accent-[#E5481A]"
              />
              <div className="flex-1 min-w-0">
                <p className="text-sm truncate">{r.item.name}</p>
                <p className="text-xs text-gray-400 truncate">
                  {r.item.source === "openfoodfacts"
                    ? `${r.item.food.name}${r.item.food.brand ? ` · ${r.item.food.brand}` : ""}`
                    : "schatting"}{" "}
                  · {kcal} kcal
                </p>
              </div>
              <Input
                type="number"
                inputMode="decimal"
                step="any"
                value={r.grams}
                onChange={(e) => setRows((prev) => prev.map((x, j) => (j === i ? { ...x, grams: e.target.value } : x)))}
                className="!w-20 !px-2 text-right"
              />
              <span className="text-xs text-gray-400">g</span>
            </div>
          );
        })}
      </div>

      <p className="text-xs text-gray-500">
        Totaal: <span className="font-medium text-gray-800">{Math.round(totals.kcal)} kcal</span> ·{" "}
        {Math.round(totals.protein)}g eiwit
      </p>
      {error && <p className="text-xs text-red-500">{error}</p>}
      <div className="flex gap-2">
        <Button className="flex-1" onClick={logAll} disabled={saving || active.length === 0}>
          {saving ? "Bezig..." : `Voeg ${active.length} item${active.length === 1 ? "" : "s"} toe`}
        </Button>
        <Button variant="secondary" onClick={onCancel} disabled={saving}>
          Terug
        </Button>
      </div>
    </div>
  );
}
