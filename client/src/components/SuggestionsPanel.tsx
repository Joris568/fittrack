import { useState } from "react";
import { api } from "../api/client.js";
import { AiInsight, WorkoutSuggestion } from "../api/types.js";
import { Button, Card } from "./ui.js";

const ACTION_LABEL: Record<WorkoutSuggestion["action"], string> = {
  increase_weight: "Zwaarder",
  increase_reps: "Meer reps",
  deload: "Lichter",
  swap: "Vervangen",
  keep: "Zo houden",
};

/** The coach looks at the whole program and proposes tweaks; nothing changes until you tap Akkoord. */
export default function SuggestionsPanel() {
  const [insight, setInsight] = useState<AiInsight<{ suggestions: WorkoutSuggestion[] }> | null>(null);
  const [loading, setLoading] = useState(false);
  const [state, setState] = useState<"idle" | "accepted" | "dismissed" | "error">("idle");
  const [error, setError] = useState<string | null>(null);

  async function generate() {
    setLoading(true);
    setError(null);
    try {
      setInsight(await api.post<AiInsight<{ suggestions: WorkoutSuggestion[] }>>("/ai/workout-suggestions/generate"));
      setState("idle");
    } catch (e) {
      setError(e instanceof Error ? e.message : "De coach kon nu geen voorstel maken.");
      setState("error");
    } finally {
      setLoading(false);
    }
  }

  async function decide(accept: boolean) {
    if (!insight) return;
    await api.post(`/ai/workout-suggestions/${insight.id}/${accept ? "accept" : "dismiss"}`);
    setState(accept ? "accepted" : "dismissed");
  }

  const changes = insight?.content.suggestions.filter((s) => s.action !== "keep") ?? [];

  return (
    <Card>
      <h2 className="font-display font-bold text-lg mb-1">Voorstel van de coach</h2>
      {!insight && (
        <>
          <p className="text-sm text-gray-500 mb-3">Laat de coach naar je hele programma kijken. Jij beslist wat er verandert.</p>
          <Button variant="secondary" className="w-full" onClick={generate} disabled={loading}>
            {loading ? "De coach kijkt mee..." : "Maak een voorstel voor volgende keer"}
          </Button>
          {error && <p className="text-xs text-red-500 mt-2">{error}</p>}
        </>
      )}
      {insight && state === "idle" && (
        <div className="space-y-3">
          {changes.length === 0 && <p className="text-sm text-gray-600">Geen wijzigingen nodig. Houd je schema zoals het is.</p>}
          {changes.map((s) => (
            <div key={s.programExerciseId} className="rounded-lg bg-gray-50 px-3 py-2.5">
              <div className="flex justify-between items-start gap-2">
                <p className="text-sm font-semibold">{s.exerciseName}</p>
                <span className="text-[10px] font-bold uppercase tracking-wide text-brand-700 bg-brand-50 rounded px-1.5 py-0.5 shrink-0">{ACTION_LABEL[s.action]}</span>
              </div>
              {(s.newTargetWeight != null || s.newTargetRepsMin != null) && (
                <p className="text-xs text-gray-600 mt-0.5">
                  {s.newTargetWeight != null ? `${s.newTargetWeight} kg` : ""}
                  {s.newTargetRepsMin != null ? ` · ${s.newTargetRepsMin}-${s.newTargetRepsMax ?? s.newTargetRepsMin} reps` : ""}
                </p>
              )}
              <p className="text-xs text-gray-500 mt-1">{s.reasoning}</p>
            </div>
          ))}
          <div className="flex gap-2">
            {changes.length > 0 && (
              <Button className="flex-1" onClick={() => decide(true)}>
                Akkoord
              </Button>
            )}
            <Button variant="secondary" className={changes.length > 0 ? "" : "flex-1"} onClick={() => decide(false)}>
              {changes.length > 0 ? "Negeer" : "Sluiten"}
            </Button>
          </div>
        </div>
      )}
      {state === "accepted" && <p className="text-sm text-brand-600 font-medium">Doorgevoerd in je programma.</p>}
      {state === "dismissed" && <p className="text-sm text-gray-500">Voorstel genegeerd. Je schema blijft zoals het was.</p>}
    </Card>
  );
}
