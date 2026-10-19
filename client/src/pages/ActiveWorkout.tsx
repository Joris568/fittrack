import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { api } from "../api/client.js";
import { Exercise, WorkoutSession, WorkoutSummary } from "../api/types.js";
import { Spinner } from "../components/ui.js";
import { useWakeLock } from "../lib/wakeLock.js";
import ExercisePicker from "../components/ExercisePicker.js";
import ExerciseSheet from "../components/ExerciseSheet.js";
import ReadinessCard, { type Readiness } from "../components/workout/ReadinessCard.js";
import RestTimer from "../components/RestTimer.js";
import ExerciseCard from "../components/workout/ExerciseCard.js";
import {
  addItem,
  deriveLayout,
  moveItem,
  nextInSuperset,
  removeItem,
  replaceItem,
  serializeLayout,
  toggleSuperset,
  workingSetCounts,
  type LayoutItem,
} from "../lib/workoutLayout.js";

function formatElapsed(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  return h > 0 ? `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}` : `${m}:${String(s).padStart(2, "0")}`;
}

export default function ActiveWorkout() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [session, setSession] = useState<WorkoutSession | null>(null);
  const [layout, setLayout] = useState<LayoutItem[] | null>(null);
  const [extraExercises, setExtraExercises] = useState<Exercise[]>([]);
  const [openId, setOpenId] = useState<string | null>(null);
  const [rest, setRest] = useState<{ key: string; seconds: number } | null>(null);
  const [picker, setPicker] = useState<{ mode: "add" } | { mode: "replace"; index: number } | null>(null);
  const [sheet, setSheet] = useState<Exercise | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [finishing, setFinishing] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  const wakeLockHeld = useWakeLock(!!session && !session.finishedAt);
  const prevCounts = useRef<Map<string, number> | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const load = useCallback(async () => {
    if (!id) return;
    const s = await api.get<WorkoutSession>(`/workouts/${id}`);
    setSession(s);
    setLayout((cur) => {
      if (!cur) return deriveLayout(s);
      // keep the user's order, but make sure anything with logged sets is present
      const present = new Set(cur.map((i) => i.exerciseId));
      const missing = deriveLayout(s).filter((i) => !present.has(i.exerciseId) && s.setLogs.some((l) => l.exerciseId === i.exerciseId));
      return missing.length ? [...cur, ...missing] : cur;
    });
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  const exerciseMap = useMemo(() => {
    const m = new Map<string, Exercise>();
    for (const pe of session?.programDay?.exercises ?? []) m.set(pe.exerciseId, pe.exercise);
    for (const l of session?.setLogs ?? []) m.set(l.exerciseId, l.exercise);
    for (const e of extraExercises) m.set(e.id, e);
    return m;
  }, [session, extraExercises]);

  const counts = useMemo(() => workingSetCounts(session?.setLogs ?? []), [session]);

  // A saved layout can contain exercises that aren't in the program or logged yet (added or
  // swapped in earlier) — look those up so they still show after a reload.
  const missingKey = layout ? layout.filter((i) => !exerciseMap.has(i.exerciseId)).map((i) => i.exerciseId).join(",") : "";
  useEffect(() => {
    if (!missingKey) return;
    const wanted = new Set(missingKey.split(","));
    api
      .get<Exercise[]>("/exercises")
      .then((all) => setExtraExercises((prev) => [...prev, ...all.filter((e) => wanted.has(e.id) && !prev.some((p) => p.id === e.id))]))
      .catch(() => {});
  }, [missingKey]);

  // open the first unfinished exercise at start; afterwards move on when one is completed
  useEffect(() => {
    if (!layout || !session) return;
    if (prevCounts.current === null) {
      const first = layout.find((i) => (counts.get(i.exerciseId) ?? 0) < i.targetSets);
      setOpenId(first?.exerciseId ?? layout[0]?.exerciseId ?? null);
    } else {
      const justFinished = layout.findIndex((i) => (prevCounts.current!.get(i.exerciseId) ?? 0) < i.targetSets && (counts.get(i.exerciseId) ?? 0) >= i.targetSets);
      if (justFinished >= 0) {
        const next = layout.slice(justFinished + 1).find((i) => (counts.get(i.exerciseId) ?? 0) < i.targetSets) ?? layout.find((i) => (counts.get(i.exerciseId) ?? 0) < i.targetSets);
        setOpenId(next?.exerciseId ?? null);
      }
    }
    prevCounts.current = counts;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [counts, session?.id, layout?.length]);

  function persist(items: LayoutItem[]) {
    setLayout(items);
    if (id) api.patch(`/workouts/${id}`, { layout: serializeLayout(items) }).catch(() => {});
  }

  function showToast(text: string) {
    setToast(text);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 3200);
  }

  async function finish() {
    if (!id || finishing || !session) return;
    const total = [...counts.values()].reduce((a, b) => a + b, 0);
    if (total === 0 && !confirm("Je hebt nog geen sets gelogd. Toch afronden?")) return;
    const planned = (layout ?? []).reduce((n, i) => n + i.targetSets, 0);
    const done = (layout ?? []).reduce((n, i) => n + Math.min(counts.get(i.exerciseId) ?? 0, i.targetSets), 0);
    if (total > 0 && done < planned && !confirm(`Je hebt ${done} van de ${planned} geplande sets gedaan. Afronden?`)) return;
    setFinishing(true);
    try {
      const summary = await api.post<WorkoutSummary>(`/workouts/${id}/finish`);
      if (navigator.vibrate) navigator.vibrate([60, 50, 60]);
      navigate(`/train/session/${id}/summary`, { state: { summary, fresh: true } });
    } catch {
      setFinishing(false);
      showToast("Afronden mislukt. Check je verbinding en probeer opnieuw.");
    }
  }

  if (!session || !layout) return <Spinner />;

  const started = new Date(session.date).getTime();
  const elapsed = now - started;
  const planned = layout.reduce((n, i) => n + i.targetSets, 0);
  const done = layout.reduce((n, i) => n + Math.min(counts.get(i.exerciseId) ?? 0, i.targetSets), 0);
  const pct = planned > 0 ? Math.round((done / planned) * 100) : 0;
  const supersetLabels = new Map<string, string>();
  for (const i of layout) if (i.groupId && !supersetLabels.has(i.groupId)) supersetLabels.set(i.groupId, String.fromCharCode(65 + supersetLabels.size));

  return (
    <div className="pb-40">
      <div className="sticky top-0 z-30 -mx-4 px-4 pt-3 pb-3 mb-4 bg-bg/95 backdrop-blur border-b border-gray-100">
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <h1 className="font-display font-bold text-xl tracking-tight truncate">{session.programDay?.name ?? "Vrije training"}</h1>
            <p className="text-xs text-gray-500">
              {elapsed < 8 * 3600_000 ? `${formatElapsed(elapsed)} · ` : ""}
              {done}/{planned} sets
              {wakeLockHeld && <span className="text-brand-600"> · scherm blijft aan</span>}
            </p>
          </div>
          <button
            onClick={finish}
            disabled={finishing}
            className="shrink-0 px-4 py-2.5 rounded-lg bg-gray-900 text-white text-sm font-semibold active:scale-[0.97] transition-transform disabled:opacity-50"
          >
            {finishing ? "Bezig..." : "Afronden"}
          </button>
        </div>
        <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden mt-2.5">
          <div className="h-full bg-brand-500 rounded-full transition-all duration-500" style={{ width: `${pct}%` }} />
        </div>
      </div>

      {toast && (
        <div className="fixed top-24 left-1/2 -translate-x-1/2 z-50 max-w-[92%] animate-pop rounded-xl bg-gray-900 text-white px-4 py-2.5 text-sm font-medium shadow-card">
          {toast}
        </div>
      )}

      {(session.readiness || session.setLogs.length === 0) && (
        <div className="mb-3">
          <ReadinessCard
            saved={(() => {
              try {
                return session.readiness ? (JSON.parse(session.readiness) as Readiness) : null;
              } catch {
                return null;
              }
            })()}
            onSave={(r) => {
              setSession((s) => (s ? { ...s, readiness: JSON.stringify(r) } : s));
              api.patch(`/workouts/${session.id}`, { readiness: JSON.stringify(r) }).catch(() => {});
            }}
            onTrim={() => persist(layout.map((i) => ({ ...i, targetSets: Math.max(1, i.targetSets - 1) })))}
          />
        </div>
      )}

      <div className="space-y-3">
        {layout.length === 0 && (
          <div className="rounded-xl border border-dashed border-gray-300 p-6 text-center text-sm text-gray-500">
            Nog geen oefeningen. Voeg je eerste oefening toe om te beginnen.
          </div>
        )}
        {layout.map((item, index) => {
          const exercise = exerciseMap.get(item.exerciseId);
          if (!exercise) return null;
          return (
            <ExerciseCard
              key={item.exerciseId}
              index={index}
              total={layout.length}
              exercise={exercise}
              item={item}
              sets={session.setLogs.filter((s) => s.exerciseId === item.exerciseId)}
              sessionId={session.id}
              open={openId === item.exerciseId}
              onToggle={() => setOpenId((cur) => (cur === item.exerciseId ? null : item.exerciseId))}
              onChange={load}
              onMove={(delta) => persist(moveItem(layout, index, delta))}
              onReplace={() => setPicker({ mode: "replace", index })}
              onRemove={() => persist(removeItem(layout, index))}
              onInfo={() => setSheet(exercise)}
              supersetLabel={supersetLabels.get(item.groupId ?? "") ?? null}
              linkedWithNext={!!item.groupId && layout[index + 1]?.groupId === item.groupId}
              onToggleSuperset={() => persist(toggleSuperset(layout, index))}
              onSetLogged={({ isPR, restSeconds, exerciseName, weight, reps }) => {
                // Superset: hop to the partner exercise with (almost) no rest; full rest once the round is done.
                const after = new Map(counts);
                after.set(item.exerciseId, (after.get(item.exerciseId) ?? 0) + 1);
                const hop = nextInSuperset(layout, index, after);
                if (hop && !hop.roundComplete) {
                  setOpenId(layout[hop.next].exerciseId);
                  setRest({ key: `${Date.now()}`, seconds: 15 });
                } else {
                  setRest({ key: `${Date.now()}`, seconds: restSeconds });
                  if (hop?.roundComplete && (after.get(item.exerciseId) ?? 0) < item.targetSets) setOpenId(layout[hop.next].exerciseId);
                }
                if (isPR) {
                  if (navigator.vibrate) navigator.vibrate([40, 60, 40, 60, 140]);
                  showToast(`Nieuw record: ${exerciseName} ${weight} kg × ${reps}`);
                } else if (navigator.vibrate) {
                  navigator.vibrate(25);
                }
              }}
            />
          );
        })}

        <button
          type="button"
          onClick={() => setPicker({ mode: "add" })}
          className="w-full rounded-xl border border-dashed border-gray-300 py-3.5 text-sm font-semibold text-gray-600 active:bg-gray-50"
        >
          + Oefening toevoegen
        </button>
      </div>

      {rest && (
        <div className="fixed left-0 right-0 z-30 px-4 bottom-[calc(4.75rem+env(safe-area-inset-bottom))]">
          <div className="max-w-2xl mx-auto shadow-card rounded-xl">
            <RestTimer seconds={rest.seconds} startKey={rest.key} onDone={() => {}} />
          </div>
        </div>
      )}

      {sheet && <ExerciseSheet exerciseId={sheet.id} name={sheet.name} onClose={() => setSheet(null)} />}

      {picker && (
        <ExercisePicker
          title={picker.mode === "add" ? "Oefening toevoegen" : "Vervang oefening"}
          excludeIds={layout.map((i) => i.exerciseId)}
          onClose={() => setPicker(null)}
          onPick={(exercise) => {
            setExtraExercises((prev) => (prev.some((e) => e.id === exercise.id) ? prev : [...prev, exercise]));
            if (picker.mode === "add") {
              persist(addItem(layout, exercise.id));
              setOpenId(exercise.id);
            } else {
              persist(replaceItem(layout, picker.index, exercise.id));
              setOpenId(exercise.id);
            }
            setPicker(null);
          }}
        />
      )}
    </div>
  );
}
