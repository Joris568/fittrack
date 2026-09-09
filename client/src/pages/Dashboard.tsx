import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../api/client.js";
import { AiInsight, FoodLogEntry, NutritionGoal, WeeklyReportContent } from "../api/types.js";
import { Card, Button, Spinner, PageTitle } from "../components/ui.js";

function MacroBar({ label, value, goal }: { label: string; value: number; goal: number }) {
  const pct = goal > 0 ? Math.min(100, Math.round((value / goal) * 100)) : 0;
  return (
    <div>
      <div className="flex justify-between text-xs text-gray-500 mb-1">
        <span>{label}</span>
        <span>
          {Math.round(value)} / {goal}g
        </span>
      </div>
      <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
        <div className="h-full bg-brand-500" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

export default function Dashboard() {
  const [goal, setGoal] = useState<NutritionGoal | null>(null);
  const [entries, setEntries] = useState<FoodLogEntry[]>([]);
  const [advice, setAdvice] = useState<AiInsight<{ text: string }> | null>(null);
  const [adviceLoading, setAdviceLoading] = useState(false);
  const [report, setReport] = useState<AiInsight<WeeklyReportContent> | null>(null);
  const [reportLoading, setReportLoading] = useState(true);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const [g, e, a] = await Promise.all([
          api.get<NutritionGoal | null>("/goals/current"),
          api.get<FoodLogEntry[]>("/food/log"),
          api.get<AiInsight<{ text: string }> | null>("/ai/nutrition-advice/latest"),
        ]);
        setGoal(g);
        setEntries(e);
        setAdvice(a);
      } finally {
        setLoading(false);
      }
      try {
        const r = await api.get<AiInsight<WeeklyReportContent>>("/ai/weekly-report/latest");
        setReport(r);
      } finally {
        setReportLoading(false);
      }
    })();
  }, []);

  async function generateAdvice() {
    setAdviceLoading(true);
    try {
      const a = await api.post<AiInsight<{ text: string }>>("/ai/nutrition-advice/generate");
      setAdvice(a);
    } finally {
      setAdviceLoading(false);
    }
  }

  const totals = entries.reduce(
    (acc, e) => {
      const f = e.quantityGrams / 100;
      acc.cal += e.foodItem.caloriesPer100g * f;
      acc.protein += e.foodItem.proteinPer100g * f;
      acc.carbs += e.foodItem.carbsPer100g * f;
      acc.fat += e.foodItem.fatPer100g * f;
      return acc;
    },
    { cal: 0, protein: 0, carbs: 0, fat: 0 }
  );

  if (loading) return <Spinner />;

  return (
    <div className="space-y-4">
      <PageTitle>Vandaag</PageTitle>

      <Card>
        <div className="flex justify-between items-center mb-3">
          <h2 className="font-semibold">Voeding</h2>
          <span className="text-sm text-gray-400">
            {Math.round(totals.cal)} {goal ? `/ ${goal.calories}` : ""} kcal
          </span>
        </div>
        {goal ? (
          <div className="space-y-2">
            <MacroBar label="Eiwit" value={totals.protein} goal={goal.proteinGrams} />
            <MacroBar label="Koolhydraten" value={totals.carbs} goal={goal.carbsGrams} />
            <MacroBar label="Vet" value={totals.fat} goal={goal.fatGrams} />
          </div>
        ) : (
          <Link to="/eat/goals" className="text-brand-600 text-sm font-medium">
            Stel een voedingsdoel in →
          </Link>
        )}
        <Link to="/eat" className="block mt-3 text-sm text-brand-600 font-medium">
          Eten loggen →
        </Link>
      </Card>

      <Card>
        <div className="flex justify-between items-center mb-2">
          <h2 className="font-semibold">AI voedingsadvies</h2>
          <Button variant="ghost" className="!px-2 !py-1 text-xs" onClick={generateAdvice} disabled={adviceLoading}>
            {adviceLoading ? "..." : "Ververs"}
          </Button>
        </div>
        {advice ? (
          <p className="text-sm text-gray-700 whitespace-pre-line">{advice.content.text}</p>
        ) : (
          <p className="text-sm text-gray-400">Nog geen advies vandaag — vraag het aan.</p>
        )}
      </Card>

      <Card>
        <h2 className="font-semibold mb-2">Wekelijks rapport</h2>
        {reportLoading ? (
          <Spinner />
        ) : report ? (
          <div className="space-y-2 text-sm">
            <p className="text-gray-700">{report.content.summary}</p>
            {report.content.wins?.length > 0 && (
              <div>
                <p className="font-medium text-brand-700">Wat ging goed</p>
                <ul className="list-disc list-inside text-gray-600">
                  {report.content.wins.map((w, i) => (
                    <li key={i}>{w}</li>
                  ))}
                </ul>
              </div>
            )}
            {report.content.recommendations?.length > 0 && (
              <div>
                <p className="font-medium text-gray-800">Aanbevelingen</p>
                <ul className="list-disc list-inside text-gray-600">
                  {report.content.recommendations.map((r, i) => (
                    <li key={i}>{r}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        ) : (
          <p className="text-sm text-gray-400">Nog niet genoeg data voor een rapport.</p>
        )}
      </Card>

      <Link to="/train">
        <Button className="w-full">Start training</Button>
      </Link>
    </div>
  );
}
