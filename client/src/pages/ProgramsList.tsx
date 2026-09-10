import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { api } from "../api/client.js";
import { ParsedProgram, WithAchievements, WorkoutProgram, WorkoutSession } from "../api/types.js";
import { Card, Button, Input, Spinner, EmptyState, PageTitle } from "../components/ui.js";
import { emitAchievements } from "../lib/achievementBus.js";

function ImportProgramForm({ onClose, onImported }: { onClose: () => void; onImported: (programId: string) => void }) {
  const [text, setText] = useState("");
  const [analyzing, setAnalyzing] = useState(false);
  const [parsed, setParsed] = useState<ParsedProgram | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function analyze() {
    if (!text.trim()) return;
    setAnalyzing(true);
    setError(null);
    setParsed(null);
    try {
      const result = await api.post<ParsedProgram>("/ai/program/parse", { text });
      setParsed(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Analyseren mislukt");
    } finally {
      setAnalyzing(false);
    }
  }

  async function save() {
    if (!parsed) return;
    setSaving(true);
    try {
      const result = await api.post<{ id: string } & WithAchievements>("/programs/import", parsed);
      emitAchievements(result.newAchievements);
      onImported(result.id);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card className="border-2 border-brand-100">
      <div className="flex justify-between items-center mb-2">
        <p className="font-medium text-sm">Programma plakken</p>
        <button className="text-xs text-gray-400" onClick={onClose}>
          annuleren
        </button>
      </div>
      <p className="text-xs text-gray-400 mb-2">
        Plak een trainingsschema (dagen, oefeningen, sets/reps) — de AI zet het om in een programma.
      </p>
      <textarea
        className="w-full px-3 py-2 rounded-xl border border-gray-200 text-sm min-h-[120px]"
        placeholder={"Bijv.\nDag 1 - Push\nBankdrukken 4x8 @80kg\nOverhead press 3x10\n\nDag 2 - Pull\nOptrekken 4x8\n..."}
        value={text}
        onChange={(e) => setText(e.target.value)}
      />
      <Button onClick={analyze} disabled={analyzing || !text.trim()} className="w-full mt-2">
        {analyzing ? "Analyseren..." : "Analyseer"}
      </Button>
      {error && <p className="text-sm text-red-500 mt-2">{error}</p>}

      {parsed && (
        <div className="mt-3 space-y-2 bg-gray-50 rounded-xl p-3">
          <p className="font-medium text-sm">{parsed.programName}</p>
          {parsed.days.map((day, i) => (
            <div key={i}>
              <p className="text-xs font-medium text-gray-700">{day.name}</p>
              {day.exercises.map((ex, j) => (
                <p key={j} className="text-xs text-gray-500">
                  {ex.exerciseName}: {ex.targetSets}x{ex.targetRepsMin}-{ex.targetRepsMax}
                  {ex.targetWeight ? ` @ ${ex.targetWeight}kg` : ""}
                </p>
              ))}
            </div>
          ))}
          <Button className="w-full" onClick={save} disabled={saving}>
            {saving ? "Opslaan..." : "Opslaan als programma"}
          </Button>
        </div>
      )}
    </Card>
  );
}

export default function ProgramsList() {
  const [programs, setPrograms] = useState<WorkoutProgram[] | null>(null);
  const [newName, setNewName] = useState("");
  const [creating, setCreating] = useState(false);
  const [importing, setImporting] = useState(false);
  const navigate = useNavigate();

  async function load() {
    setPrograms(await api.get<WorkoutProgram[]>("/programs"));
  }

  useEffect(() => {
    load();
  }, []);

  async function createProgram(e: React.FormEvent) {
    e.preventDefault();
    if (!newName.trim()) return;
    const program = await api.post<WorkoutProgram & WithAchievements>("/programs", { name: newName });
    emitAchievements(program.newAchievements);
    setNewName("");
    setCreating(false);
    navigate(`/train/programs/${program.id}`);
  }

  async function startDay(dayId: string) {
    const session = await api.post<WorkoutSession & WithAchievements>("/workouts", { programDayId: dayId });
    emitAchievements(session.newAchievements);
    navigate(`/train/session/${session.id}`);
  }

  async function startFreestyle() {
    const session = await api.post<WorkoutSession & WithAchievements>("/workouts", {});
    emitAchievements(session.newAchievements);
    navigate(`/train/session/${session.id}`);
  }

  if (!programs) return <Spinner />;

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <PageTitle>Trainen</PageTitle>
        <Link to="/train/history" className="text-brand-600 text-sm font-medium">
          Geschiedenis
        </Link>
      </div>

      <Button variant="secondary" className="w-full" onClick={startFreestyle}>
        Vrije training starten
      </Button>

      {programs.length === 0 && !creating && !importing && (
        <EmptyState>Nog geen programma&apos;s. Bouw je eerste routine.</EmptyState>
      )}

      {programs.map((program) => (
        <Card key={program.id}>
          <div className="flex justify-between items-start mb-2">
            <div>
              <h2 className="font-semibold">{program.name}</h2>
              {program.description && <p className="text-xs text-gray-400">{program.description}</p>}
            </div>
            <Link to={`/train/programs/${program.id}`} className="text-sm text-brand-600 font-medium">
              Bewerken
            </Link>
          </div>
          {program.days.length === 0 ? (
            <p className="text-sm text-gray-400">Nog geen dagen toegevoegd.</p>
          ) : (
            <div className="space-y-2">
              {program.days.map((day) => (
                <div key={day.id} className="flex justify-between items-center bg-gray-50 rounded-xl px-3 py-2">
                  <div>
                    <p className="text-sm font-medium">{day.name}</p>
                    <p className="text-xs text-gray-400">{day.exercises.length} oefeningen</p>
                  </div>
                  <Button className="!px-3 !py-1.5 text-xs" onClick={() => startDay(day.id)}>
                    Start
                  </Button>
                </div>
              ))}
            </div>
          )}
        </Card>
      ))}

      {importing ? (
        <ImportProgramForm
          onClose={() => setImporting(false)}
          onImported={(programId) => navigate(`/train/programs/${programId}`)}
        />
      ) : creating ? (
        <Card>
          <form onSubmit={createProgram} className="flex gap-2">
            <Input
              placeholder="Naam programma (bv. Push Pull Legs)"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              autoFocus
            />
            <Button type="submit">Aanmaken</Button>
          </form>
        </Card>
      ) : (
        <div className="flex gap-2">
          <Button variant="secondary" className="flex-1" onClick={() => setCreating(true)}>
            + Nieuw programma
          </Button>
          <Button variant="secondary" className="flex-1" onClick={() => setImporting(true)}>
            📋 Programma plakken
          </Button>
        </div>
      )}
    </div>
  );
}
