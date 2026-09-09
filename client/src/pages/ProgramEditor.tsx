import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { api } from "../api/client.js";
import { AiInsight, Exercise, ProgramDay, WorkoutProgram, WorkoutSuggestion } from "../api/types.js";
import { Button, Card, Input, Spinner, EmptyState } from "../components/ui.js";

function AddExerciseForm({ dayId, onAdded }: { dayId: string; onAdded: () => void }) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Exercise[]>([]);
  const [selected, setSelected] = useState<Exercise | null>(null);
  const [sets, setSets] = useState(3);
  const [repsMin, setRepsMin] = useState(8);
  const [repsMax, setRepsMax] = useState(12);
  const [weight, setWeight] = useState<string>("");

  useEffect(() => {
    if (!query.trim() || selected) {
      setResults([]);
      return;
    }
    const t = setTimeout(async () => {
      const res = await api.get<Exercise[]>(`/exercises?q=${encodeURIComponent(query)}`);
      setResults(res);
    }, 200);
    return () => clearTimeout(t);
  }, [query, selected]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!selected) return;
    await api.post(`/programs/days/${dayId}/exercises`, {
      exerciseId: selected.id,
      targetSets: sets,
      targetRepsMin: repsMin,
      targetRepsMax: repsMax,
      targetWeight: weight ? Number(weight) : undefined,
    });
    setSelected(null);
    setQuery("");
    setWeight("");
    onAdded();
  }

  return (
    <form onSubmit={submit} className="bg-gray-50 rounded-xl p-3 space-y-2 mt-2">
      {!selected ? (
        <div>
          <Input placeholder="Zoek oefening..." value={query} onChange={(e) => setQuery(e.target.value)} />
          {results.length > 0 && (
            <div className="mt-1 bg-white border border-gray-200 rounded-lg overflow-hidden">
              {results.map((r) => (
                <button
                  type="button"
                  key={r.id}
                  className="w-full text-left px-3 py-2 text-sm hover:bg-gray-50 border-b border-gray-100 last:border-0"
                  onClick={() => setSelected(r)}
                >
                  {r.name} <span className="text-gray-400 text-xs">({r.muscleGroup})</span>
                </button>
              ))}
            </div>
          )}
        </div>
      ) : (
        <>
          <div className="flex justify-between items-center">
            <span className="text-sm font-medium">{selected.name}</span>
            <button type="button" className="text-xs text-gray-400" onClick={() => setSelected(null)}>
              wijzig
            </button>
          </div>
          <div className="flex gap-2">
            <Input
              type="number"
              value={sets}
              onChange={(e) => setSets(Number(e.target.value))}
              placeholder="Sets"
            />
            <Input
              type="number"
              value={repsMin}
              onChange={(e) => setRepsMin(Number(e.target.value))}
              placeholder="Reps min"
            />
            <Input
              type="number"
              value={repsMax}
              onChange={(e) => setRepsMax(Number(e.target.value))}
              placeholder="Reps max"
            />
          </div>
          <Input
            type="number"
            value={weight}
            onChange={(e) => setWeight(e.target.value)}
            placeholder="Startgewicht (kg, optioneel)"
          />
          <Button type="submit" className="w-full">
            Toevoegen
          </Button>
        </>
      )}
    </form>
  );
}

function DayCard({ day, onChange }: { day: ProgramDay; onChange: () => void }) {
  const [adding, setAdding] = useState(false);

  async function removeExercise(id: string) {
    await api.delete(`/programs/exercises/${id}`);
    onChange();
  }

  async function removeDay() {
    if (!confirm(`Dag "${day.name}" verwijderen?`)) return;
    await api.delete(`/programs/days/${day.id}`);
    onChange();
  }

  return (
    <Card>
      <div className="flex justify-between items-center mb-2">
        <h3 className="font-semibold">{day.name}</h3>
        <button className="text-xs text-red-500" onClick={removeDay}>
          verwijderen
        </button>
      </div>
      <div className="space-y-1.5">
        {day.exercises.map((pe) => (
          <div key={pe.id} className="flex justify-between items-center bg-gray-50 rounded-lg px-3 py-2 text-sm">
            <div>
              <p className="font-medium">{pe.exercise.name}</p>
              <p className="text-xs text-gray-400">
                {pe.targetSets}x{pe.targetRepsMin}-{pe.targetRepsMax}
                {pe.targetWeight ? ` @ ${pe.targetWeight}kg` : ""}
              </p>
            </div>
            <button className="text-xs text-gray-400" onClick={() => removeExercise(pe.id)}>
              ✕
            </button>
          </div>
        ))}
      </div>
      {adding ? (
        <AddExerciseForm
          dayId={day.id}
          onAdded={() => {
            setAdding(false);
            onChange();
          }}
        />
      ) : (
        <button className="text-sm text-brand-600 font-medium mt-2" onClick={() => setAdding(true)}>
          + Oefening toevoegen
        </button>
      )}
    </Card>
  );
}

function SuggestionsPanel() {
  const [insight, setInsight] = useState<AiInsight<{ suggestions: WorkoutSuggestion[] }> | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function generate() {
    setLoading(true);
    setError(null);
    try {
      const res = await api.post<AiInsight<{ suggestions: WorkoutSuggestion[] }>>(
        "/ai/workout-suggestions/generate"
      );
      setInsight(res);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Mislukt");
    } finally {
      setLoading(false);
    }
  }

  async function accept() {
    if (!insight) return;
    await api.post(`/ai/workout-suggestions/${insight.id}/accept`);
    setInsight({ ...insight, status: "accepted" });
  }

  async function dismiss() {
    if (!insight) return;
    await api.post(`/ai/workout-suggestions/${insight.id}/dismiss`);
    setInsight(null);
  }

  return (
    <Card>
      <div className="flex justify-between items-center mb-2">
        <h3 className="font-semibold">AI programma-optimalisatie</h3>
        <Button variant="ghost" className="!px-2 !py-1 text-xs" onClick={generate} disabled={loading}>
          {loading ? "Bezig..." : "Analyseer"}
        </Button>
      </div>
      {error && <p className="text-sm text-red-500">{error}</p>}
      {!insight && !loading && (
        <p className="text-sm text-gray-400">Laat AI je trainingsgeschiedenis analyseren voor concrete aanpassingen.</p>
      )}
      {insight && (
        <div className="space-y-2">
          {insight.content.suggestions.map((s, i) => (
            <div key={i} className="bg-gray-50 rounded-lg px-3 py-2 text-sm">
              <p className="font-medium">{s.exerciseName}</p>
              <p className="text-gray-600 text-xs">{s.reasoning}</p>
              {(s.newTargetWeight || s.newTargetRepsMin) && (
                <p className="text-xs text-brand-700 mt-1">
                  Nieuw: {s.newTargetRepsMin ?? "-"}-{s.newTargetRepsMax ?? "-"} reps
                  {s.newTargetWeight ? ` @ ${s.newTargetWeight}kg` : ""}
                </p>
              )}
            </div>
          ))}
          {insight.status === "pending" ? (
            <div className="flex gap-2">
              <Button className="flex-1" onClick={accept}>
                Toepassen
              </Button>
              <Button variant="secondary" className="flex-1" onClick={dismiss}>
                Negeren
              </Button>
            </div>
          ) : (
            <p className="text-xs text-gray-400">Status: {insight.status}</p>
          )}
        </div>
      )}
    </Card>
  );
}

export default function ProgramEditor() {
  const { id } = useParams<{ id: string }>();
  const [program, setProgram] = useState<WorkoutProgram | null>(null);
  const [newDayName, setNewDayName] = useState("");
  const navigate = useNavigate();

  async function load() {
    if (!id) return;
    setProgram(await api.get<WorkoutProgram>(`/programs/${id}`));
  }

  useEffect(() => {
    load();
  }, [id]);

  async function addDay(e: React.FormEvent) {
    e.preventDefault();
    if (!newDayName.trim() || !id) return;
    await api.post(`/programs/${id}/days`, { name: newDayName, order: program?.days.length ?? 0 });
    setNewDayName("");
    load();
  }

  async function deleteProgram() {
    if (!id || !confirm("Programma volledig verwijderen?")) return;
    await api.delete(`/programs/${id}`);
    navigate("/train");
  }

  if (!program) return <Spinner />;

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-start">
        <h1 className="text-xl font-bold">{program.name}</h1>
        <button className="text-xs text-red-500" onClick={deleteProgram}>
          Programma verwijderen
        </button>
      </div>

      <SuggestionsPanel />

      {program.days.length === 0 && <EmptyState>Nog geen trainingsdagen.</EmptyState>}

      {program.days.map((day) => (
        <DayCard key={day.id} day={day} onChange={load} />
      ))}

      <Card>
        <form onSubmit={addDay} className="flex gap-2">
          <Input
            placeholder="Nieuwe dag (bv. Push Day A)"
            value={newDayName}
            onChange={(e) => setNewDayName(e.target.value)}
          />
          <Button type="submit">Toevoegen</Button>
        </form>
      </Card>
    </div>
  );
}
