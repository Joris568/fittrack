import { useEffect, useState } from "react";
import { api } from "../api/client.js";
import { NutritionGoal } from "../api/types.js";
import { Button, Card, Input, PageTitle } from "../components/ui.js";

export default function Goals() {
  const [current, setCurrent] = useState<NutritionGoal | null>(null);
  const [form, setForm] = useState({ calories: "", proteinGrams: "", carbsGrams: "", fatGrams: "" });
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    api.get<NutritionGoal | null>("/goals/current").then((g) => {
      setCurrent(g);
      if (g) {
        setForm({
          calories: String(g.calories),
          proteinGrams: String(g.proteinGrams),
          carbsGrams: String(g.carbsGrams),
          fatGrams: String(g.fatGrams),
        });
      }
    });
  }, []);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    const goal = await api.post<NutritionGoal>("/goals", {
      calories: Number(form.calories),
      proteinGrams: Number(form.proteinGrams),
      carbsGrams: Number(form.carbsGrams),
      fatGrams: Number(form.fatGrams),
    });
    setCurrent(goal);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  return (
    <div className="space-y-4">
      <PageTitle>Voedingsdoel</PageTitle>
      <Card>
        <form onSubmit={save} className="space-y-3">
          <div>
            <label className="text-xs text-gray-500">Calorieën (kcal)</label>
            <Input
              type="number"
              value={form.calories}
              onChange={(e) => setForm((f) => ({ ...f, calories: e.target.value }))}
              required
            />
          </div>
          <div>
            <label className="text-xs text-gray-500">Eiwit (g)</label>
            <Input
              type="number"
              value={form.proteinGrams}
              onChange={(e) => setForm((f) => ({ ...f, proteinGrams: e.target.value }))}
              required
            />
          </div>
          <div>
            <label className="text-xs text-gray-500">Koolhydraten (g)</label>
            <Input
              type="number"
              value={form.carbsGrams}
              onChange={(e) => setForm((f) => ({ ...f, carbsGrams: e.target.value }))}
              required
            />
          </div>
          <div>
            <label className="text-xs text-gray-500">Vet (g)</label>
            <Input
              type="number"
              value={form.fatGrams}
              onChange={(e) => setForm((f) => ({ ...f, fatGrams: e.target.value }))}
              required
            />
          </div>
          <Button type="submit" className="w-full">
            Opslaan
          </Button>
          {saved && <p className="text-sm text-brand-600 text-center">Opgeslagen!</p>}
        </form>
      </Card>
      {current && (
        <p className="text-xs text-gray-400 text-center">
          Actief sinds {new Date(current.effectiveFrom).toLocaleDateString("nl-NL")}
        </p>
      )}
    </div>
  );
}
