import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../api/client.js";
import { FoodLogEntry, ParsedRecipe, Recipe, WithAchievements } from "../api/types.js";
import { Button, Card, Input, PageTitle, Spinner, EmptyState } from "../components/ui.js";
import { emitAchievements } from "../lib/achievementBus.js";

const MEAL_LABELS: Record<FoodLogEntry["mealType"], string> = {
  breakfast: "Ontbijt",
  lunch: "Lunch",
  dinner: "Diner",
  snack: "Snack",
};

function LogRecipeForm({ recipe, onLogged }: { recipe: Recipe; onLogged: () => void }) {
  const [mealType, setMealType] = useState<FoodLogEntry["mealType"]>("lunch");
  const [portions, setPortions] = useState("1");
  const [busy, setBusy] = useState(false);

  async function log() {
    if (!recipe.foodItemId) return;
    setBusy(true);
    try {
      const entry = await api.post<WithAchievements>("/food/log", {
        mealType,
        quantityGrams: Number(portions) * 100,
        foodItemId: recipe.foodItemId,
      });
      emitAchievements(entry.newAchievements);
      onLogged();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex gap-2 items-center mt-2">
      <select
        className="px-2 py-2 rounded-lg border border-gray-200 text-sm"
        value={mealType}
        onChange={(e) => setMealType(e.target.value as FoodLogEntry["mealType"])}
      >
        {Object.entries(MEAL_LABELS).map(([key, label]) => (
          <option key={key} value={key}>
            {label}
          </option>
        ))}
      </select>
      <Input
        type="number"
        inputMode="decimal"
        step="0.5"
        value={portions}
        onChange={(e) => setPortions(e.target.value)}
        className="!w-20"
      />
      <span className="text-xs text-gray-400">porties</span>
      <Button className="!px-3 !py-2 text-sm ml-auto" onClick={log} disabled={busy || !recipe.foodItemId}>
        Loggen
      </Button>
    </div>
  );
}

export default function Recipes() {
  const [recipes, setRecipes] = useState<Recipe[] | null>(null);
  const [text, setText] = useState("");
  const [servings, setServings] = useState("");
  const [analyzing, setAnalyzing] = useState(false);
  const [analyzed, setAnalyzed] = useState<ParsedRecipe | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [savedMsg, setSavedMsg] = useState(false);

  async function load() {
    setRecipes(await api.get<Recipe[]>("/recipes"));
  }

  useEffect(() => {
    load();
  }, []);

  async function analyze() {
    if (!text.trim()) return;
    setAnalyzing(true);
    setError(null);
    setAnalyzed(null);
    try {
      const result = await api.post<ParsedRecipe>("/ai/recipe/parse", {
        text,
        servings: servings ? Number(servings) : undefined,
      });
      setAnalyzed(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Analyseren mislukt");
    } finally {
      setAnalyzing(false);
    }
  }

  async function saveRecipe() {
    if (!analyzed) return;
    await api.post("/recipes", {
      name: analyzed.name,
      sourceText: text,
      servings: analyzed.servings,
      caloriesPerServing: analyzed.totalCalories / analyzed.servings,
      proteinPerServing: analyzed.totalProtein / analyzed.servings,
      carbsPerServing: analyzed.totalCarbs / analyzed.servings,
      fatPerServing: analyzed.totalFat / analyzed.servings,
      ingredients: analyzed.ingredients,
    });
    setAnalyzed(null);
    setText("");
    setServings("");
    setSavedMsg(true);
    setTimeout(() => setSavedMsg(false), 2000);
    load();
  }

  async function deleteRecipe(id: string) {
    if (!confirm("Recept verwijderen?")) return;
    await api.delete(`/recipes/${id}`);
    load();
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <PageTitle>Recepten</PageTitle>
        <Link to="/eat" className="text-sm text-brand-600 font-medium">
          ← Eten
        </Link>
      </div>

      <Card>
        <h2 className="font-semibold mb-2">Recept plakken</h2>
        <p className="text-xs text-gray-400 mb-2">
          Plak ingrediënten en/of bereidingswijze — de AI schat de voedingswaarden per portie in.
        </p>
        <textarea
          className="w-full px-3 py-2 rounded-xl border border-gray-200 text-sm min-h-[120px]"
          placeholder={"Bijv.\n300g kipfilet\n200g rijst\n1 courgette\n2 el olijfolie\n..."}
          value={text}
          onChange={(e) => setText(e.target.value)}
        />
        <div className="flex gap-2 mt-2">
          <Input
            type="number"
            placeholder="Aantal porties (optioneel)"
            value={servings}
            onChange={(e) => setServings(e.target.value)}
          />
          <Button onClick={analyze} disabled={analyzing || !text.trim()} className="shrink-0">
            {analyzing ? "Analyseren..." : "Analyseer"}
          </Button>
        </div>
        {error && <p className="text-sm text-red-500 mt-2">{error}</p>}

        {analyzed && (
          <div className="mt-3 space-y-2 bg-gray-50 rounded-xl p-3">
            <p className="font-medium text-sm">
              {analyzed.name} · {analyzed.servings} porties
            </p>
            <div className="space-y-1">
              {analyzed.ingredients.map((ing, i) => (
                <p key={i} className="text-xs text-gray-500">
                  {ing.name} — {ing.quantity} ({Math.round(ing.estimatedCalories)} kcal)
                </p>
              ))}
            </div>
            <p className="text-sm text-gray-700">
              Totaal: {Math.round(analyzed.totalCalories)} kcal · {Math.round(analyzed.totalProtein)}g eiwit ·{" "}
              {Math.round(analyzed.totalCarbs)}g koolh. · {Math.round(analyzed.totalFat)}g vet
            </p>
            <p className="text-sm font-medium text-brand-700">
              Per portie: {Math.round(analyzed.totalCalories / analyzed.servings)} kcal ·{" "}
              {Math.round(analyzed.totalProtein / analyzed.servings)}g eiwit
            </p>
            <Button className="w-full" onClick={saveRecipe}>
              Opslaan
            </Button>
          </div>
        )}
        {savedMsg && <p className="text-sm text-brand-600 text-center mt-2">Recept opgeslagen!</p>}
      </Card>

      {recipes === null ? (
        <Spinner />
      ) : recipes.length === 0 ? (
        <EmptyState>Nog geen recepten opgeslagen.</EmptyState>
      ) : (
        recipes.map((r) => (
          <Card key={r.id}>
            <div className="flex justify-between items-start">
              <div>
                <p className="font-semibold">{r.name}</p>
                <p className="text-xs text-gray-400">
                  {Math.round(r.caloriesPerServing)} kcal · {Math.round(r.proteinPerServing)}g eiwit per portie
                </p>
              </div>
              <button className="text-xs text-red-500" onClick={() => deleteRecipe(r.id)}>
                verwijderen
              </button>
            </div>
            <LogRecipeForm recipe={r} onLogged={load} />
          </Card>
        ))
      )}
    </div>
  );
}
