import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { api } from "../api/client.js";
import { Exercise, ProgramExercise, SetLog, WithAchievements, WorkoutSession } from "../api/types.js";
import { Button, Card, Input, Spinner } from "../components/ui.js";
import { emitAchievements } from "../lib/achievementBus.js";
import RestTimer from "../components/RestTimer.js";
import { calculatePlatesPerSide } from "../lib/plates.js";

const DEFAULT_REST_SECONDS = 90;

function SetRow({ set, onDelete }: { set: SetLog; onDelete: () => void }) {
  return (
    <div className="flex justify-between items-center text-sm py-1.5 border-b border-gray-100 last:border-0">
      <span>
        Set {set.setNumber}: <strong>{set.reps}</strong> reps @ <strong>{set.weight}</strong>kg
        {set.rpe ? ` (RPE ${set.rpe})` : ""}
        {set.isPR && <span className="ml-1.5 text-amber-600 font-semibold">🏆 PR</span>}
      </span>
      <button className="text-gray-300 text-xs" onClick={onDelete}>
        ✕
      </button>
    </div>
  );
}

function ExerciseBlock({
  exercise,
  target,
  sets,
  sessionId,
  onChange,
}: {
  exercise: Exercise;
  target?: ProgramExercise;
  sets: SetLog[];
  sessionId: string;
  onChange: () => void;
}) {
  const [reps, setReps] = useState(target ? String(target.targetRepsMin) : "");
  const [weight, setWeight] = useState(target?.targetWeight ? String(target.targetWeight) : "");
  const [rpe, setRpe] = useState("");
  const [lastTime, setLastTime] = useState<SetLog[] | null>(null);
  const [restKey, setRestKey] = useState<string | null>(null);
  const [showPlates, setShowPlates] = useState(false);

  useEffect(() => {
    api.get<SetLog[]>(`/workouts/exercise/${exercise.id}/history`).then((h) => {
      const filtered = h.filter((s) => s.workoutSessionId !== sessionId);
      setLastTime(filtered.slice(0, 3));
    });
  }, [exercise.id, sessionId]);

  async function addSet(e: React.FormEvent) {
    e.preventDefault();
    if (!reps || !weight) return;
    const result = await api.post<SetLog & WithAchievements>(`/workouts/${sessionId}/sets`, {
      exerciseId: exercise.id,
      setNumber: sets.length + 1,
      reps: Number(reps),
      weight: Number(weight),
      rpe: rpe ? Number(rpe) : undefined,
    });
    emitAchievements(result.newAchievements);
    setRpe("");
    setRestKey(result.id);
    onChange();
  }

  async function deleteSet(id: string) {
    await api.delete(`/workouts/sets/${id}`);
    onChange();
  }

  return (
    <Card>
      <h3 className="font-semibold mb-1">{exercise.name}</h3>
      {target && (
        <p className="text-xs text-gray-400 mb-1">
          Doel: {target.targetSets}x{target.targetRepsMin}-{target.targetRepsMax}
          {target.targetWeight ? ` @ ${target.targetWeight}kg` : ""}
        </p>
      )}
      {lastTime && lastTime.length > 0 && (
        <p className="text-xs text-gray-400 mb-2">
          Vorige keer: {lastTime.map((s) => `${s.reps}x${s.weight}kg`).join(", ")}
        </p>
      )}
      {sets.length > 0 && (
        <div className="mb-2">
          {sets.map((s) => (
            <SetRow key={s.id} set={s} onDelete={() => deleteSet(s.id)} />
          ))}
        </div>
      )}
      <form onSubmit={addSet} className="flex gap-2 items-center">
        <Input
          type="number"
          inputMode="decimal"
          step="0.1"
          placeholder="kg"
          value={weight}
          onChange={(e) => setWeight(e.target.value)}
          className="!py-2"
        />
        <Input
          type="number"
          inputMode="numeric"
          placeholder="reps"
          value={reps}
          onChange={(e) => setReps(e.target.value)}
          className="!py-2"
        />
        <Input
          type="number"
          inputMode="numeric"
          placeholder="RPE"
          value={rpe}
          onChange={(e) => setRpe(e.target.value)}
          className="!py-2"
        />
        <Button type="submit" className="!px-3 !py-2 shrink-0">
          Set {sets.length + 1}
        </Button>
      </form>
      {weight && Number(weight) > 20 && (
        <button
          type="button"
          className="text-xs text-gray-400 mt-1.5"
          onClick={() => setShowPlates((v) => !v)}
        >
          🏋️ platen per kant {showPlates ? "▲" : "▼"}
        </button>
      )}
      {showPlates && weight && (
        <p className="text-xs text-gray-500 mt-1">
          {(() => {
            const plates = calculatePlatesPerSide(Number(weight));
            return plates.length > 0
              ? `${plates.join(" + ")}kg per kant (bar 20kg)`
              : "Alleen de lege stang (20kg) nodig.";
          })()}
        </p>
      )}
      {restKey && (
        <div className="mt-2">
          <RestTimer
            seconds={target?.restSeconds ?? DEFAULT_REST_SECONDS}
            startKey={restKey}
            onDone={() => {}}
          />
        </div>
      )}
    </Card>
  );
}

export default function ActiveWorkout() {
  const { id } = useParams<{ id: string }>();
  const [session, setSession] = useState<WorkoutSession | null>(null);
  const [extraExercises, setExtraExercises] = useState<Exercise[]>([]);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Exercise[]>([]);
  const navigate = useNavigate();

  async function load() {
    if (!id) return;
    const s = await api.get<WorkoutSession>(`/workouts/${id}`);
    setSession(s);
  }

  useEffect(() => {
    load();
  }, [id]);

  useEffect(() => {
    if (!query.trim()) {
      setResults([]);
      return;
    }
    const t = setTimeout(async () => {
      setResults(await api.get<Exercise[]>(`/exercises?q=${encodeURIComponent(query)}`));
    }, 200);
    return () => clearTimeout(t);
  }, [query]);

  if (!session) return <Spinner />;

  const plannedExercises = session.programDay?.exercises ?? [];
  const setsByExercise = new Map<string, SetLog[]>();
  for (const s of session.setLogs) {
    const arr = setsByExercise.get(s.exerciseId) ?? [];
    arr.push(s);
    setsByExercise.set(s.exerciseId, arr);
  }

  const plannedIds = new Set(plannedExercises.map((pe) => pe.exerciseId));
  const extraLogged = [...setsByExercise.keys()]
    .filter((exId) => !plannedIds.has(exId))
    .map((exId) => setsByExercise.get(exId)![0].exercise);

  const allExtra = [...extraLogged, ...extraExercises.filter((e) => !extraLogged.some((x) => x.id === e.id))];

  return (
    <div className="space-y-4 pb-6">
      <div className="flex justify-between items-center">
        <h1 className="text-xl font-bold">{session.programDay?.name ?? "Vrije training"}</h1>
        <Button variant="secondary" className="!px-3 !py-1.5 text-sm" onClick={() => navigate("/train")}>
          Klaar
        </Button>
      </div>

      {plannedExercises.map((pe) => (
        <ExerciseBlock
          key={pe.id}
          exercise={pe.exercise}
          target={pe}
          sets={setsByExercise.get(pe.exerciseId) ?? []}
          sessionId={session.id}
          onChange={load}
        />
      ))}

      {allExtra.map((ex) => (
        <ExerciseBlock
          key={ex.id}
          exercise={ex}
          sets={setsByExercise.get(ex.id) ?? []}
          sessionId={session.id}
          onChange={load}
        />
      ))}

      <Card>
        <p className="text-sm font-medium mb-2">Extra oefening toevoegen</p>
        <Input placeholder="Zoek oefening..." value={query} onChange={(e) => setQuery(e.target.value)} />
        {results.length > 0 && (
          <div className="mt-1 bg-white border border-gray-200 rounded-lg overflow-hidden">
            {results.map((r) => (
              <button
                key={r.id}
                className="w-full text-left px-3 py-2 text-sm hover:bg-gray-50 border-b border-gray-100 last:border-0"
                onClick={() => {
                  setExtraExercises((prev) => [...prev, r]);
                  setQuery("");
                  setResults([]);
                }}
              >
                {r.name}
              </button>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
