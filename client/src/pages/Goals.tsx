import { useEffect, useState } from "react";
import { api } from "../api/client.js";
import { AiInsight, GoalProposalContent, NutritionGoal } from "../api/types.js";
import { Button, Card, Input, PageTitle } from "../components/ui.js";

function CoachChallenge({ onAccepted }: { onAccepted: (goal: NutritionGoal) => void }) {
  const [proposal, setProposal] = useState<AiInsight<GoalProposalContent> | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api.get<AiInsight<GoalProposalContent>[]>("/ai/goal-proposal").then((list) => {
      const pending = list.find((p) => p.status === "pending");
      if (pending) setProposal(pending);
    });
  }, []);

  async function generate() {
    setLoading(true);
    setError(null);
    try {
      const res = await api.post<AiInsight<GoalProposalContent>>("/ai/goal-proposal/generate");
      setProposal(res);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Mislukt");
    } finally {
      setLoading(false);
    }
  }

  async function accept() {
    if (!proposal) return;
    await api.post(`/ai/goal-proposal/${proposal.id}/accept`);
    onAccepted({
      id: "",
      calories: proposal.content.proposedGoal.calories,
      proteinGrams: proposal.content.proposedGoal.proteinGrams,
      carbsGrams: proposal.content.proposedGoal.carbsGrams,
      fatGrams: proposal.content.proposedGoal.fatGrams,
      effectiveFrom: new Date().toISOString(),
    });
    setProposal({ ...proposal, status: "accepted" });
  }

  async function dismiss() {
    if (!proposal) return;
    await api.post(`/ai/goal-proposal/${proposal.id}/dismiss`);
    setProposal(null);
  }

  return (
    <Card>
      <div className="flex justify-between items-center mb-2">
        <h2 className="font-semibold">Coach-uitdaging</h2>
        <Button variant="ghost" className="!px-2 !py-1 text-xs" onClick={generate} disabled={loading}>
          {loading ? "..." : "Daag me uit"}
        </Button>
      </div>
      {error && <p className="text-sm text-red-500">{error}</p>}
      {!proposal && !loading && (
        <p className="text-sm text-gray-400">
          Laat de coach kritisch naar je voortgang kijken en een scherper doel voorstellen.
        </p>
      )}
      {proposal && (
        <div className="space-y-2">
          <p className="text-sm font-medium text-gray-800">{proposal.content.challenge}</p>
          <p className="text-sm text-gray-600">{proposal.content.reasoning}</p>
          <div className="bg-gray-50 rounded-lg px-3 py-2 text-sm">
            Voorgesteld: {proposal.content.proposedGoal.calories} kcal · {proposal.content.proposedGoal.proteinGrams}g
            eiwit · {proposal.content.proposedGoal.carbsGrams}g koolh. · {proposal.content.proposedGoal.fatGrams}g vet
          </div>
          {proposal.status === "pending" ? (
            <div className="flex gap-2">
              <Button className="flex-1" onClick={accept}>
                Toepassen
              </Button>
              <Button variant="secondary" className="flex-1" onClick={dismiss}>
                Negeren
              </Button>
            </div>
          ) : (
            <p className="text-xs text-gray-400">Status: {proposal.status}</p>
          )}
        </div>
      )}
    </Card>
  );
}

export default function Goals() {
  const [current, setCurrent] = useState<NutritionGoal | null>(null);
  const [form, setForm] = useState({ calories: "", proteinGrams: "", carbsGrams: "", fatGrams: "" });
  const [saved, setSaved] = useState(false);

  function applyGoal(g: NutritionGoal) {
    setCurrent(g);
    setForm({
      calories: String(g.calories),
      proteinGrams: String(g.proteinGrams),
      carbsGrams: String(g.carbsGrams),
      fatGrams: String(g.fatGrams),
    });
  }

  useEffect(() => {
    api.get<NutritionGoal | null>("/goals/current").then((g) => {
      if (g) applyGoal(g);
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
    applyGoal(goal);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  return (
    <div className="space-y-4">
      <PageTitle>Voedingsdoel</PageTitle>

      <CoachChallenge onAccepted={applyGoal} />

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
