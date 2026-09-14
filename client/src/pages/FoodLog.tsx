import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, ReferenceLine } from "recharts";
import { api } from "../api/client.js";
import {
  FavoriteFood,
  FoodItem,
  FoodLogEntry,
  FoodSearchResult,
  NutritionDaySummary,
  NutritionGoal,
  RecentFood,
  WithAchievements,
} from "../api/types.js";
import { Button, Card, Input, Spinner, PageTitle } from "../components/ui.js";
import { emitAchievements } from "../lib/achievementBus.js";
import BarcodeScanner from "../components/BarcodeScanner.js";

const MEAL_TYPES: { key: FoodLogEntry["mealType"]; label: string }[] = [
  { key: "breakfast", label: "Ontbijt" },
  { key: "lunch", label: "Lunch" },
  { key: "dinner", label: "Diner" },
  { key: "snack", label: "Snack" },
];

function toDateKey(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function formatDayLabel(d: Date): string {
  const today = toDateKey(new Date());
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const key = toDateKey(d);
  if (key === today) return "Vandaag";
  if (key === toDateKey(yesterday)) return "Gisteren";
  return d.toLocaleDateString("nl-NL", { weekday: "long", day: "numeric", month: "long" });
}

function NutritionTrendChart({ goal }: { goal: NutritionGoal | null }) {
  const [data, setData] = useState<NutritionDaySummary[] | null>(null);

  useEffect(() => {
    api.get<NutritionDaySummary[]>("/food/log/summary?days=14").then(setData);
  }, []);

  if (!data || data.every((d) => d.cal === 0)) return null;

  const chartData = data.map((d) => ({
    date: new Date(d.date).toLocaleDateString("nl-NL", { day: "2-digit", month: "2-digit" }),
    kcal: Math.round(d.cal),
  }));

  return (
    <Card>
      <h2 className="font-semibold mb-2">Calorieën (laatste 14 dagen)</h2>
      <ResponsiveContainer width="100%" height={160}>
        <BarChart data={chartData}>
          <XAxis dataKey="date" fontSize={10} interval={1} tick={{ fill: "#8890A3" }} />
          <YAxis fontSize={10} width={30} tick={{ fill: "#8890A3" }} />
          <Tooltip contentStyle={{ background: "#151A22", border: "1px solid #2A3140", color: "#F4F5F9" }} />
          {goal && <ReferenceLine y={goal.calories} stroke="#3A4254" strokeDasharray="4 4" />}
          <Bar dataKey="kcal" fill="#3FDE84" radius={[4, 4, 0, 0]} isAnimationActive={false} />
        </BarChart>
      </ResponsiveContainer>
    </Card>
  );
}

function AddFoodPanel({
  mealType,
  date,
  onAdded,
  onClose,
}: {
  mealType: FoodLogEntry["mealType"];
  date: Date;
  onAdded: () => void;
  onClose: () => void;
}) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<FoodSearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [selected, setSelected] = useState<(FoodSearchResult & { id?: string }) | null>(null);
  const [quantity, setQuantity] = useState("100");
  const [manual, setManual] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [manualForm, setManualForm] = useState({ name: "", cal: "", protein: "", carbs: "", fat: "" });
  const [searchError, setSearchError] = useState<string | null>(null);
  const [favorites, setFavorites] = useState<FavoriteFood[]>([]);
  const [recent, setRecent] = useState<RecentFood[]>([]);

  useEffect(() => {
    api.get<FavoriteFood[]>("/food/favorites").then(setFavorites);
    api.get<RecentFood[]>("/food/recent").then(setRecent);
  }, []);

  useEffect(() => {
    if (!query.trim()) {
      setResults([]);
      setSearchError(null);
      return;
    }
    setSearching(true);
    setSearchError(null);
    const t = setTimeout(async () => {
      try {
        const res = await api.get<FoodSearchResult[]>(`/food/search?q=${encodeURIComponent(query)}`);
        setResults(res);
      } catch {
        setSearchError("Voedseldatabase niet bereikbaar, probeer het nog eens.");
      } finally {
        setSearching(false);
      }
    }, 350);
    return () => clearTimeout(t);
  }, [query]);

  async function handleBarcodeDetected(code: string) {
    setScanning(false);
    setSearchError(null);
    try {
      const item = await api.get<FoodSearchResult>(`/food/barcode/${encodeURIComponent(code)}`);
      setSelected(item);
    } catch {
      setSearchError("Geen product gevonden voor deze barcode. Probeer te zoeken op naam.");
    }
  }

  function pickKnownItem(item: FoodItem, defaultQuantity?: number) {
    setSelected({ ...item, barcode: item.barcode ?? null, brand: item.brand ?? null, fiberPer100g: item.fiberPer100g ?? null });
    setQuantity(String(defaultQuantity ?? 100));
  }

  async function confirmSelected() {
    if (!selected || !quantity) return;
    const entry = await api.post<WithAchievements>("/food/log", {
      mealType,
      quantityGrams: Number(quantity),
      ...(selected.id ? { foodItemId: selected.id } : { foodItem: selected }),
      date: date.toISOString(),
    });
    emitAchievements(entry.newAchievements);
    onAdded();
  }

  async function toggleFavorite() {
    if (!selected?.id) return;
    const isFav = favorites.some((f) => f.foodItem.id === selected.id);
    if (isFav) {
      await api.delete(`/food/favorites/${selected.id}`);
      setFavorites((prev) => prev.filter((f) => f.foodItem.id !== selected.id));
    } else {
      await api.post("/food/favorites", { foodItemId: selected.id });
      setFavorites(await api.get<FavoriteFood[]>("/food/favorites"));
    }
  }

  async function confirmManual() {
    if (!manualForm.name || !manualForm.cal) return;
    const item = await api.post<{ id: string }>("/food/custom", {
      name: manualForm.name,
      caloriesPer100g: Number(manualForm.cal),
      proteinPer100g: Number(manualForm.protein || 0),
      carbsPer100g: Number(manualForm.carbs || 0),
      fatPer100g: Number(manualForm.fat || 0),
    });
    const entry = await api.post<WithAchievements>("/food/log", {
      mealType,
      quantityGrams: Number(quantity || 100),
      foodItemId: item.id,
      date: date.toISOString(),
    });
    emitAchievements(entry.newAchievements);
    onAdded();
  }

  return (
    <Card className="border-2 border-brand-100">
      <div className="flex justify-between items-center mb-2">
        <p className="font-medium text-sm">Toevoegen aan {MEAL_TYPES.find((m) => m.key === mealType)?.label}</p>
        <button className="text-xs text-gray-400" onClick={onClose}>
          annuleren
        </button>
      </div>

      {scanning && (
        <BarcodeScanner onDetected={handleBarcodeDetected} onClose={() => setScanning(false)} />
      )}

      {manual ? (
        <div className="space-y-2">
          <Input
            placeholder="Naam"
            value={manualForm.name}
            onChange={(e) => setManualForm((f) => ({ ...f, name: e.target.value }))}
          />
          <div className="flex gap-2">
            <Input
              type="number"
              placeholder="kcal/100g"
              value={manualForm.cal}
              onChange={(e) => setManualForm((f) => ({ ...f, cal: e.target.value }))}
            />
            <Input
              type="number"
              placeholder="eiwit/100g"
              value={manualForm.protein}
              onChange={(e) => setManualForm((f) => ({ ...f, protein: e.target.value }))}
            />
          </div>
          <div className="flex gap-2">
            <Input
              type="number"
              placeholder="koolh./100g"
              value={manualForm.carbs}
              onChange={(e) => setManualForm((f) => ({ ...f, carbs: e.target.value }))}
            />
            <Input
              type="number"
              placeholder="vet/100g"
              value={manualForm.fat}
              onChange={(e) => setManualForm((f) => ({ ...f, fat: e.target.value }))}
            />
          </div>
          <Input
            type="number"
            placeholder="Hoeveelheid (g)"
            value={quantity}
            onChange={(e) => setQuantity(e.target.value)}
          />
          <Button className="w-full" onClick={confirmManual}>
            Toevoegen
          </Button>
          <button className="text-xs text-gray-400 w-full text-center" onClick={() => setManual(false)}>
            Terug naar zoeken
          </button>
        </div>
      ) : selected ? (
        <div className="space-y-2">
          <div className="flex justify-between items-start">
            <p className="text-sm font-medium">
              {selected.name} {selected.brand && <span className="text-gray-400">· {selected.brand}</span>}
            </p>
            {selected.id && (
              <button className="text-lg leading-none shrink-0" onClick={toggleFavorite} type="button">
                {favorites.some((f) => f.foodItem.id === selected.id) ? "★" : "☆"}
              </button>
            )}
          </div>
          <p className="text-xs text-gray-400">
            {selected.caloriesPer100g} kcal / {selected.proteinPer100g}g eiwit per 100g
          </p>
          <Input
            type="number"
            placeholder="Hoeveelheid (g)"
            value={quantity}
            onChange={(e) => setQuantity(e.target.value)}
            autoFocus
          />
          <div className="flex gap-2">
            <Button className="flex-1" onClick={confirmSelected}>
              Toevoegen
            </Button>
            <Button variant="secondary" onClick={() => setSelected(null)}>
              Terug
            </Button>
          </div>
        </div>
      ) : (
        <div className="space-y-2">
          <div className="flex gap-2">
            <Input
              placeholder="Zoek product..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              autoFocus
              className="flex-1"
            />
            <Button variant="secondary" className="!px-3 shrink-0" onClick={() => setScanning(true)}>
              📷 Scan
            </Button>
          </div>
          {searching && <p className="text-xs text-gray-400">Zoeken...</p>}
          {searchError && <p className="text-xs text-red-500">{searchError}</p>}

          {!query.trim() && favorites.length > 0 && (
            <div>
              <p className="text-xs text-gray-400 font-medium mb-1">★ Favorieten</p>
              <div className="space-y-1">
                {favorites.map((f) => (
                  <button
                    key={f.id}
                    className="w-full text-left px-3 py-2 rounded-lg bg-gray-50 hover:bg-gray-100 text-sm"
                    onClick={() => pickKnownItem(f.foodItem)}
                  >
                    <p className="font-medium">{f.foodItem.name}</p>
                    <p className="text-xs text-gray-400">{Math.round(f.foodItem.caloriesPer100g)} kcal/100g</p>
                  </button>
                ))}
              </div>
            </div>
          )}

          {!query.trim() && recent.length > 0 && (
            <div>
              <p className="text-xs text-gray-400 font-medium mb-1">↻ Recent</p>
              <div className="space-y-1">
                {recent.map((r, i) => (
                  <button
                    key={i}
                    className="w-full text-left px-3 py-2 rounded-lg bg-gray-50 hover:bg-gray-100 text-sm"
                    onClick={() => pickKnownItem(r.foodItem, r.lastQuantityGrams)}
                  >
                    <p className="font-medium">{r.foodItem.name}</p>
                    <p className="text-xs text-gray-400">
                      laatst {r.lastQuantityGrams}g · {Math.round(r.foodItem.caloriesPer100g)} kcal/100g
                    </p>
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="max-h-64 overflow-y-auto space-y-1">
            {results.map((r, i) => (
              <button
                key={i}
                className="w-full text-left px-3 py-2 rounded-lg bg-gray-50 hover:bg-gray-100 text-sm"
                onClick={() => setSelected(r)}
              >
                <p className="font-medium">{r.name}</p>
                <p className="text-xs text-gray-400">
                  {r.brand ? `${r.brand} · ` : ""}
                  {Math.round(r.caloriesPer100g)} kcal/100g
                </p>
              </button>
            ))}
          </div>
          <button className="text-xs text-brand-600 font-medium" onClick={() => setManual(true)}>
            Niet gevonden? Handmatig invoeren
          </button>
        </div>
      )}
    </Card>
  );
}

export default function FoodLog() {
  const [date, setDate] = useState(() => new Date());
  const [entries, setEntries] = useState<FoodLogEntry[] | null>(null);
  const [goal, setGoal] = useState<NutritionGoal | null>(null);
  const [addingMeal, setAddingMeal] = useState<FoodLogEntry["mealType"] | null>(null);
  const [copyingMeal, setCopyingMeal] = useState<FoodLogEntry["mealType"] | null>(null);
  const [copySourceDate, setCopySourceDate] = useState("");
  const [copyError, setCopyError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setEntries(null);
    const [e, g] = await Promise.all([
      api.get<FoodLogEntry[]>(`/food/log?date=${toDateKey(date)}`),
      api.get<NutritionGoal | null>("/goals/current"),
    ]);
    setEntries(e);
    setGoal(g);
  }, [date]);

  useEffect(() => {
    load();
  }, [load]);

  async function removeEntry(id: string) {
    await api.delete(`/food/log/${id}`);
    load();
  }

  function openCopy(meal: FoodLogEntry["mealType"]) {
    const yesterday = new Date(date);
    yesterday.setDate(yesterday.getDate() - 1);
    setCopySourceDate(toDateKey(yesterday));
    setCopyError(null);
    setCopyingMeal(meal);
  }

  async function confirmCopy() {
    if (!copyingMeal || !copySourceDate) return;
    setCopyError(null);
    try {
      const result = await api.post<WithAchievements>("/food/log/copy", {
        mealType: copyingMeal,
        fromDate: new Date(copySourceDate + "T12:00:00").toISOString(),
        toDate: date.toISOString(),
      });
      emitAchievements(result.newAchievements);
      setCopyingMeal(null);
      load();
    } catch (err) {
      setCopyError(err instanceof Error ? err.message : "Kopiëren mislukt");
    }
  }

  function shiftDay(deltaDays: number) {
    setDate((d) => {
      const next = new Date(d);
      next.setDate(next.getDate() + deltaDays);
      return next;
    });
  }

  const isToday = toDateKey(date) === toDateKey(new Date());

  if (!entries) return <Spinner />;

  const totals = entries.reduce(
    (acc, e) => {
      const f = e.quantityGrams / 100;
      acc.cal += e.foodItem.caloriesPer100g * f;
      acc.protein += e.foodItem.proteinPer100g * f;
      return acc;
    },
    { cal: 0, protein: 0 }
  );

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <PageTitle>Eten</PageTitle>
        <div className="flex items-center gap-3">
          <Link to="/eat/recipes" className="text-sm text-brand-600 font-medium">
            Recepten
          </Link>
          <Link to="/eat/goals" className="text-sm text-brand-600 font-medium">
            Doelen
          </Link>
        </div>
      </div>

      <div className="flex items-center justify-between">
        <button className="text-lg px-2 py-1 text-gray-400" onClick={() => shiftDay(-1)} aria-label="Vorige dag">
          ‹
        </button>
        <div className="flex flex-col items-center">
          <span className="font-medium text-sm">{formatDayLabel(date)}</span>
          <input
            type="date"
            value={toDateKey(date)}
            onChange={(e) => e.target.value && setDate(new Date(e.target.value + "T12:00:00"))}
            className="text-xs text-gray-400 bg-transparent"
          />
        </div>
        <button
          className="text-lg px-2 py-1 text-gray-400 disabled:opacity-20"
          onClick={() => shiftDay(1)}
          disabled={isToday}
          aria-label="Volgende dag"
        >
          ›
        </button>
      </div>

      <Card>
        <div className="flex justify-between text-sm">
          <span>
            {Math.round(totals.cal)} {goal ? `/ ${goal.calories}` : ""} kcal
          </span>
          <span>
            {Math.round(totals.protein)}
            {goal ? `/${goal.proteinGrams}` : ""}g eiwit
          </span>
        </div>
      </Card>

      {isToday && <NutritionTrendChart goal={goal} />}

      {MEAL_TYPES.map((meal) => {
        const mealEntries = entries.filter((e) => e.mealType === meal.key);
        return (
          <Card key={meal.key}>
            <div className="flex justify-between items-center mb-2">
              <h3 className="font-semibold">{meal.label}</h3>
              <div className="flex items-center gap-3">
                <button className="text-xs text-gray-400 font-medium" onClick={() => openCopy(meal.key)}>
                  ↻ kopieer
                </button>
                <button className="text-xs text-brand-600 font-medium" onClick={() => setAddingMeal(meal.key)}>
                  + toevoegen
                </button>
              </div>
            </div>
            {copyingMeal === meal.key && (
              <div className="bg-gray-50 rounded-lg px-3 py-2 mb-2 space-y-2">
                <p className="text-xs text-gray-500">
                  Kopieer {meal.label.toLowerCase()} van een andere dag naar {formatDayLabel(date).toLowerCase()}:
                </p>
                <div className="flex gap-2 items-center">
                  <input
                    type="date"
                    value={copySourceDate}
                    max={toDateKey(new Date())}
                    onChange={(e) => setCopySourceDate(e.target.value)}
                    className="text-sm border border-gray-200 rounded-lg px-2 py-1.5 flex-1"
                  />
                  <Button className="!px-3 !py-1.5 text-sm" onClick={confirmCopy}>
                    Kopieer
                  </Button>
                  <button className="text-xs text-gray-400" onClick={() => setCopyingMeal(null)}>
                    annuleren
                  </button>
                </div>
                {copyError && <p className="text-xs text-red-500">{copyError}</p>}
              </div>
            )}
            {mealEntries.length === 0 ? (
              <p className="text-xs text-gray-400">Nog niets gelogd.</p>
            ) : (
              <div className="space-y-1">
                {mealEntries.map((e) => (
                  <div key={e.id} className="flex justify-between items-center text-sm">
                    <span>
                      {e.foodItem.name} · {e.quantityGrams}g
                    </span>
                    <div className="flex items-center gap-2">
                      <span className="text-gray-400 text-xs">
                        {Math.round((e.foodItem.caloriesPer100g * e.quantityGrams) / 100)} kcal
                      </span>
                      <button className="text-gray-300" onClick={() => removeEntry(e.id)}>
                        ✕
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
            {addingMeal === meal.key && (
              <div className="mt-2">
                <AddFoodPanel
                  mealType={meal.key}
                  date={date}
                  onAdded={() => {
                    setAddingMeal(null);
                    load();
                  }}
                  onClose={() => setAddingMeal(null)}
                />
              </div>
            )}
          </Card>
        );
      })}
    </div>
  );
}
