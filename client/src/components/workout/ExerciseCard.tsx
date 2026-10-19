import { useEffect, useRef, useState } from "react";
import { api } from "../../api/client.js";
import { Exercise, SetLog, WithAchievements } from "../../api/types.js";
import { emitAchievements } from "../../lib/achievementBus.js";
import { enqueueSet, getQueuedSets, isNetworkError, subscribeQueue, type QueuedSet } from "../../lib/offlineQueue.js";
import { calculatePlatesPerSide } from "../../lib/plates.js";
import { suggestNext, weightStep, type Suggestion } from "../../lib/progression.js";
import type { LayoutItem } from "../../lib/workoutLayout.js";
import Stepper from "./Stepper.js";

export const DEFAULT_REST_SECONDS = 90;

function Linkified({ text }: { text: string }) {
  return (
    <>
      {text.split(/(https?:\/\/\S+)/g).map((part, i) =>
        /^https?:\/\//.test(part) ? (
          <a key={i} href={part} target="_blank" rel="noreferrer" className="underline text-brand-700 break-all">
            {part.replace(/^https?:\/\/(www\.)?/, "").slice(0, 40)}
          </a>
        ) : (
          <span key={i}>{part}</span>
        )
      )}
    </>
  );
}
const RPE_OPTIONS = [6, 7, 8, 9, 10];

interface Props {
  index: number;
  total: number;
  exercise: Exercise;
  item: LayoutItem;
  sets: SetLog[];
  sessionId: string;
  open: boolean;
  onToggle: () => void;
  onChange: () => void;
  onMove: (delta: -1 | 1) => void;
  onReplace: () => void;
  onRemove: () => void;
  onInfo: () => void;
  /** e.g. "A" for the first superset in the training; null when not in one */
  supersetLabel?: string | null;
  linkedWithNext?: boolean;
  onToggleSuperset?: () => void;
  onSetLogged: (info: { isPR: boolean; restSeconds: number; exerciseName: string; weight: number; reps: number }) => void;
}

export default function ExerciseCard(p: Props) {
  const { exercise, item, sets, sessionId } = p;
  const working = sets.filter((s) => !s.isWarmup);
  const done = working.length >= item.targetSets;

  // continue from the last set logged in this training, else the program's target
  const lastLogged = working[working.length - 1];
  const [weight, setWeight] = useState(lastLogged ? String(lastLogged.weight) : item.targetWeight ? String(item.targetWeight) : "");
  const [reps, setReps] = useState(lastLogged ? String(lastLogged.reps) : String(item.repsMin));
  const [rpe, setRpe] = useState<number | null>(null);
  const [warmup, setWarmup] = useState(false);
  const [lastSets, setLastSets] = useState<SetLog[] | null>(null);
  const [suggestion, setSuggestion] = useState<Suggestion | null>(null);
  const [queued, setQueued] = useState<QueuedSet[]>(() => getQueuedSets(sessionId).filter((q) => q.payload.exerciseId === exercise.id));
  const [menu, setMenu] = useState(false);
  const [showPlates, setShowPlates] = useState(false);
  const [saving, setSaving] = useState(false);
  const [note, setNote] = useState(exercise.notes ?? "");
  const [editingNote, setEditingNote] = useState(false);
  const [noteDraft, setNoteDraft] = useState("");
  const loaded = useRef(false);
  const prefilled = useRef(false);

  // Fetch last time's sets once the card is opened (not for every card up front).
  useEffect(() => {
    if (!p.open || loaded.current) return;
    loaded.current = true;
    api
      .get<SetLog[]>(`/workouts/exercise/${exercise.id}/history`)
      .then((h) => {
        const filtered = h.filter((s) => s.workoutSessionId !== sessionId && !s.isWarmup);
        const lastSession = filtered.filter((s) => s.workoutSessionId === filtered[0]?.workoutSessionId).reverse();
        setLastSets(lastSession);
        const next = suggestNext(lastSession, item.repsMin, item.repsMax);
        setSuggestion(next);
        if (next && !prefilled.current && working.length === 0) {
          setWeight(String(next.weight));
          setReps(String(next.reps));
        } else if (!next && lastSession[0] && !prefilled.current && working.length === 0) {
          setWeight(String(lastSession[0].weight));
        }
      })
      .catch(() => setLastSets([]));
  }, [p.open, exercise.id, sessionId, item.repsMin, item.repsMax, working.length]);

  useEffect(() => {
    const refresh = () => setQueued(getQueuedSets(sessionId).filter((q) => q.payload.exerciseId === exercise.id));
    const unsubscribe = subscribeQueue(refresh);
    const onSynced = () => p.onChange();
    window.addEventListener("fittrack:synced", onSynced);
    return () => {
      unsubscribe();
      window.removeEventListener("fittrack:synced", onSynced);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId, exercise.id]);

  async function logSet() {
    if (saving || !reps || weight === "") return;
    setSaving(true);
    prefilled.current = true;
    const clientId = crypto.randomUUID();
    const payload = {
      exerciseId: exercise.id,
      setNumber: sets.length + queued.length + 1,
      reps: Number(reps),
      weight: Number(weight),
      rpe: rpe ?? undefined,
      isWarmup: warmup || undefined,
    };
    try {
      const result = await api.post<SetLog & WithAchievements>(`/workouts/${sessionId}/sets`, { ...payload, clientId }, { signal: AbortSignal.timeout(12_000) });
      emitAchievements(result.newAchievements);
      p.onSetLogged({ isPR: result.isPR, restSeconds: warmup ? 45 : item.restSeconds ?? DEFAULT_REST_SECONDS, exerciseName: exercise.name, weight: payload.weight, reps: payload.reps });
      p.onChange();
    } catch (err) {
      if (!isNetworkError(err)) throw err;
      enqueueSet(sessionId, payload, clientId);
      p.onSetLogged({ isPR: false, restSeconds: item.restSeconds ?? DEFAULT_REST_SECONDS, exerciseName: exercise.name, weight: payload.weight, reps: payload.reps });
    } finally {
      setRpe(null);
      setWarmup(false);
      setSaving(false);
    }
  }

  async function saveNote() {
    const value = noteDraft.trim();
    try {
      const res = await api.patch<{ notes: string | null }>(`/exercises/${exercise.id}/note`, { note: value });
      setNote(res.notes ?? "");
      exercise.notes = res.notes;
    } catch {
      // keep the old note on a failed save
    }
    setEditingNote(false);
  }

  async function deleteSet(id: string) {
    await api.delete(`/workouts/sets/${id}`);
    p.onChange();
  }

  const nextNumber = sets.length + queued.length + 1;
  const planned = Math.max(item.targetSets, working.length);
  const extra = working.length >= item.targetSets;
  const bestLast = lastSets && lastSets.length ? lastSets.reduce((a, b) => (b.weight > a.weight ? b : a)) : null;

  return (
    <div className={`rounded-xl border bg-surface shadow-card transition-colors ${done ? "border-brand-200" : "border-gray-100"}`}>
      <button type="button" onClick={p.onToggle} className="w-full flex items-center gap-3 px-4 py-3.5 text-left" aria-expanded={p.open}>
        <span
          className={`w-8 h-8 shrink-0 rounded-full flex items-center justify-center text-sm font-bold ${
            done ? "bg-brand-500 text-white animate-pop" : "bg-gray-100 text-gray-600"
          }`}
        >
          {done ? "✓" : p.index + 1}
        </span>
        <span className="flex-1 min-w-0">
          <span className="block font-semibold truncate">
            {p.supersetLabel && (
              <span className="mr-1.5 align-middle text-[10px] font-bold tracking-wide text-brand-700 bg-brand-50 rounded px-1.5 py-0.5">
                SUPERSET {p.supersetLabel}
              </span>
            )}
            {exercise.name}
          </span>
          <span className="block text-xs text-gray-500 truncate">
            {item.targetSets} × {item.repsMin}-{item.repsMax}
            {bestLast ? ` · vorige keer ${bestLast.weight} kg` : ""}
          </span>
        </span>
        <span className="flex items-center gap-1" aria-hidden="true">
          {Array.from({ length: Math.min(planned, 6) }).map((_, i) => (
            <span key={i} className={`w-2 h-2 rounded-full ${i < working.length ? "bg-brand-500" : "bg-gray-200"}`} />
          ))}
        </span>
        <span className={`text-gray-400 transition-transform ${p.open ? "rotate-90" : ""}`}>›</span>
      </button>

      {p.open && (
        <div className="px-4 pb-4 space-y-3">
          <div className="flex gap-1.5 flex-wrap">
            <button type="button" onClick={p.onInfo} className="px-3 py-1.5 rounded-lg bg-gray-100 text-xs font-semibold text-gray-700">
              Uitleg &amp; voortgang
            </button>
            <button type="button" onClick={() => setMenu((m) => !m)} className="px-3 py-1.5 rounded-lg bg-gray-100 text-xs font-semibold text-gray-700">
              Aanpassen {menu ? "▲" : "▼"}
            </button>
          </div>
          {menu && (
            <div className="grid grid-cols-2 gap-1.5">
              {p.onToggleSuperset && (
                <button
                  type="button"
                  disabled={p.index === p.total - 1}
                  onClick={p.onToggleSuperset}
                  className="col-span-2 py-2 rounded-lg border border-gray-200 text-xs font-medium disabled:opacity-30"
                >
                  {p.linkedWithNext ? "Ontkoppel van de volgende (superset)" : "Superset met de volgende oefening"}
                </button>
              )}
              <button type="button" disabled={p.index === 0} onClick={() => p.onMove(-1)} className="py-2 rounded-lg border border-gray-200 text-xs font-medium disabled:opacity-30">
                ▲ Omhoog
              </button>
              <button type="button" disabled={p.index === p.total - 1} onClick={() => p.onMove(1)} className="py-2 rounded-lg border border-gray-200 text-xs font-medium disabled:opacity-30">
                ▼ Omlaag
              </button>
              <button type="button" disabled={sets.length > 0} onClick={p.onReplace} className="py-2 rounded-lg border border-gray-200 text-xs font-medium disabled:opacity-30">
                Vervang oefening
              </button>
              <button type="button" disabled={sets.length > 0} onClick={p.onRemove} className="py-2 rounded-lg border border-red-100 text-red-600 text-xs font-medium disabled:opacity-30">
                Verwijder
              </button>
              {sets.length > 0 && <p className="col-span-2 text-[11px] text-gray-400">Vervangen en verwijderen kan alleen zolang er geen sets gelogd zijn.</p>}
            </div>
          )}

          {editingNote ? (
            <div className="space-y-1.5">
              <textarea
                value={noteDraft}
                onChange={(e) => setNoteDraft(e.target.value)}
                rows={2}
                maxLength={400}
                placeholder="bv. stoel op 4, smalle grip, link naar een techniekvideo"
                className="w-full rounded-lg border border-gray-200 bg-bg-raised px-3 py-2 text-sm focus:outline-none focus:border-gray-900"
                autoFocus
              />
              <div className="flex gap-2">
                <button type="button" onClick={saveNote} className="px-3 py-1.5 rounded-lg bg-gray-900 text-white text-xs font-semibold">
                  Opslaan
                </button>
                <button type="button" onClick={() => setEditingNote(false)} className="px-3 py-1.5 rounded-lg bg-gray-100 text-xs font-medium">
                  Annuleer
                </button>
              </div>
            </div>
          ) : note ? (
            <div className="rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-900 flex justify-between gap-2">
              <span className="min-w-0">
                <Linkified text={note} />
              </span>
              <button
                type="button"
                className="shrink-0 font-semibold text-amber-700"
                onClick={() => {
                  setNoteDraft(note);
                  setEditingNote(true);
                }}
              >
                Wijzig
              </button>
            </div>
          ) : (
            <button
              type="button"
              className="text-xs text-gray-500 font-medium"
              onClick={() => {
                setNoteDraft("");
                setEditingNote(true);
              }}
            >
              + Notitie bij deze oefening
            </button>
          )}

          {lastSets && lastSets.length > 0 && (
            <p className="text-xs text-gray-500">Vorige keer: {lastSets.map((s) => `${s.reps}×${s.weight}`).join(" · ")}</p>
          )}
          {suggestion && working.length === 0 && (
            <button
              type="button"
              onClick={() => {
                setWeight(String(suggestion.weight));
                setReps(String(suggestion.reps));
              }}
              className="w-full text-left text-xs rounded-lg bg-brand-50 text-brand-700 px-3 py-2"
            >
              <span className="font-semibold">Suggestie: {suggestion.weight} kg × {suggestion.reps}.</span> {suggestion.text}
            </button>
          )}

          {(sets.length > 0 || queued.length > 0) && (
            <div>
              {sets.map((s) => (
                <div key={s.id} className="flex items-center gap-2.5 py-2 border-b border-gray-100 last:border-0">
                  <span className={`w-6 h-6 rounded-full flex items-center justify-center text-[11px] font-bold ${s.isWarmup ? "bg-gray-100 text-gray-500" : "bg-brand-500 text-white"}`}>
                    {s.isWarmup ? "W" : "✓"}
                  </span>
                  <span className="flex-1 text-sm">
                    <strong className="font-display">{s.weight}</strong> kg × <strong className="font-display">{s.reps}</strong>
                    {s.rpe ? <span className="text-gray-400"> · RPE {s.rpe}</span> : null}
                    {s.isWarmup && <span className="text-gray-400"> · opwarmen</span>}
                  </span>
                  {s.isPR && <span className="animate-pop text-[10px] font-bold tracking-wide text-white bg-brand-500 rounded px-1.5 py-0.5">PR</span>}
                  <button className="text-gray-300 text-sm px-1" onClick={() => deleteSet(s.id)} aria-label="Verwijder set">
                    ✕
                  </button>
                </div>
              ))}
              {queued.map((q) => (
                <div key={q.clientId} className="flex items-center gap-2.5 py-2 border-b border-gray-100 last:border-0 text-gray-500">
                  <span className="w-6 h-6 rounded-full bg-amber-100 text-amber-700 text-[11px] font-bold flex items-center justify-center">…</span>
                  <span className="flex-1 text-sm">
                    {String(q.payload.weight)} kg × {String(q.payload.reps)}
                  </span>
                  <span className="text-[11px] text-amber-700">wacht op verbinding</span>
                </div>
              ))}
            </div>
          )}

          <div className="rounded-lg bg-gray-50 p-3 space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-sm font-semibold">
                {warmup ? "Opwarmset" : extra ? `Extra set ${nextNumber}` : `Set ${working.length + 1} van ${item.targetSets}`}
              </p>
              <button
                type="button"
                onClick={() => setWarmup((w) => !w)}
                className={`px-2.5 py-1 rounded-full text-[11px] font-semibold border ${warmup ? "bg-gray-900 text-white border-gray-900" : "bg-surface text-gray-500 border-gray-200"}`}
              >
                Opwarmset
              </button>
            </div>
            <div className="flex gap-2.5">
              <Stepper label="Gewicht (kg)" value={weight} step={weightStep(Number(weight) || 0)} decimals onChange={setWeight} />
              <Stepper label={`Reps${warmup ? "" : ` (doel ${item.repsMin}-${item.repsMax})`}`} value={reps} step={1} onChange={setReps} />
            </div>
            {!warmup && (
              <div>
                <p className="text-[11px] font-medium text-gray-500 mb-1">Hoe zwaar? (RPE, optioneel)</p>
                <div className="grid grid-cols-5 gap-1.5">
                  {RPE_OPTIONS.map((r) => (
                    <button
                      key={r}
                      type="button"
                      onClick={() => setRpe((cur) => (cur === r ? null : r))}
                      className={`py-2 rounded-lg text-sm font-semibold border ${rpe === r ? "bg-gray-900 text-white border-gray-900" : "bg-surface text-gray-600 border-gray-200"}`}
                    >
                      {r}
                    </button>
                  ))}
                </div>
                <p className="text-[10px] text-gray-400 mt-1">10 = niets meer in de tank, 9 = 1 herhaling over, 8 = 2 over.</p>
              </div>
            )}
            <button
              type="button"
              onClick={logSet}
              disabled={saving || !reps || weight === ""}
              className="w-full rounded-xl bg-gray-900 text-white font-semibold py-3.5 text-base active:scale-[0.98] transition-transform disabled:opacity-40"
            >
              {saving ? "Opslaan..." : `Log ${warmup ? "opwarmset" : `set ${nextNumber}`}`}
            </button>
            {Number(weight) > 20 && (
              <button type="button" className="text-[11px] text-gray-400" onClick={() => setShowPlates((v) => !v)}>
                Platen per kant {showPlates ? "▲" : "▼"}
              </button>
            )}
            {showPlates && Number(weight) > 20 && (
              <p className="text-xs text-gray-500">
                {(() => {
                  const plates = calculatePlatesPerSide(Number(weight));
                  return plates.length > 0 ? `${plates.join(" + ")} kg per kant (stang 20 kg)` : "Alleen de lege stang (20 kg).";
                })()}
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
