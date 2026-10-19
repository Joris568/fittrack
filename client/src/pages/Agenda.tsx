import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { api } from "../api/client.js";
import { CalendarDay, WithAchievements, WorkoutProgram } from "../api/types.js";
import { Button, Card, Input, PageTitle } from "../components/ui.js";
import { emitAchievements } from "../lib/achievementBus.js";
import ConsistencyGrid from "../components/ConsistencyGrid.js";
import { addDays, formatDayLong, formatMonth, todayKey, weekStart } from "../lib/dates.js";

const WEEKDAYS = ["Ma", "Di", "Wo", "Do", "Vr", "Za", "Zo"];

export default function Agenda() {
  const navigate = useNavigate();
  const today = todayKey();
  const [month, setMonth] = useState(() => today.slice(0, 7) + "-01");
  const [selected, setSelected] = useState(today);
  const [days, setDays] = useState<Record<string, CalendarDay>>({});
  const [loadError, setLoadError] = useState(false);
  const [adding, setAdding] = useState(false);
  const [programs, setPrograms] = useState<WorkoutProgram[] | null>(null);
  const [choice, setChoice] = useState("");
  const [customTitle, setCustomTitle] = useState("");
  const [busy, setBusy] = useState(false);
  const [repeatWeeks, setRepeatWeeks] = useState(1);
  const [planning, setPlanning] = useState(false);
  const [weekProgram, setWeekProgram] = useState("");
  const [weekdays, setWeekdays] = useState<number[]>([0, 2, 4]);
  const [weekCount, setWeekCount] = useState(4);
  const [planMessage, setPlanMessage] = useState<string | null>(null);

  // Whole weeks covering the month, so the grid has no gaps.
  const cells = useMemo(() => {
    const start = weekStart(month);
    const nextMonth = new Date(`${month}T00:00:00Z`);
    nextMonth.setUTCMonth(nextMonth.getUTCMonth() + 1);
    const lastDay = addDays(nextMonth.toISOString().slice(0, 10), -1);
    const out: string[] = [];
    for (let d = start; d <= addDays(weekStart(lastDay), 6); d = addDays(d, 1)) out.push(d);
    return out;
  }, [month]);

  const load = useCallback(async () => {
    try {
      const params = new URLSearchParams({
        from: cells[0],
        to: cells[cells.length - 1],
        tz: String(new Date().getTimezoneOffset()),
      });
      const res = await api.get<{ days: Record<string, CalendarDay> }>(`/calendar?${params}`);
      setDays(res.days);
      setLoadError(false);
    } catch {
      setLoadError(true);
    }
  }, [cells]);

  useEffect(() => {
    load();
  }, [load]);

  function shiftMonth(delta: number) {
    const d = new Date(`${month}T00:00:00Z`);
    d.setUTCMonth(d.getUTCMonth() + delta);
    const next = d.toISOString().slice(0, 10);
    setMonth(next);
    setSelected(next.slice(0, 7) === today.slice(0, 7) ? today : next);
  }

  async function openAddForm() {
    setAdding(true);
    if (!programs) setPrograms(await api.get<WorkoutProgram[]>("/programs"));
  }

  async function addPlan() {
    if (!choice && !customTitle.trim()) return;
    setBusy(true);
    try {
      await api.post("/calendar/planned", {
        date: selected,
        ...(choice ? { programDayId: choice } : { title: customTitle.trim() }),
        ...(repeatWeeks > 1 ? { repeatWeeks } : {}),
      });
      setAdding(false);
      setChoice("");
      setCustomTitle("");
      setRepeatWeeks(1);
      await load();
    } finally {
      setBusy(false);
    }
  }

  async function openPlanning() {
    setPlanning(true);
    setPlanMessage(null);
    const list = programs ?? (await api.get<WorkoutProgram[]>("/programs"));
    setPrograms(list);
    if (!weekProgram && list.length) setWeekProgram((list.find((p) => p.isActive) ?? list[0]).id);
  }

  async function planWeeks() {
    if (!weekProgram || weekdays.length === 0) return;
    setBusy(true);
    try {
      const res = await api.post<{ created: number }>("/calendar/plan-week", {
        programId: weekProgram,
        weekdays,
        weeks: weekCount,
        startDate: today,
      });
      setPlanMessage(res.created > 0 ? `${res.created} trainingen ingepland.` : "Alles stond er al.");
      await load();
    } catch {
      setPlanMessage("Inplannen mislukt.");
    } finally {
      setBusy(false);
    }
  }

  async function moveToToday(id: string) {
    await api.patch(`/calendar/planned/${id}`, { date: today });
    setSelected(today);
    await load();
  }

  async function startPlanned(id: string) {
    setBusy(true);
    try {
      const session = await api.post<{ id: string } & Partial<WithAchievements>>(`/calendar/planned/${id}/start`);
      if (session.newAchievements) emitAchievements(session.newAchievements);
      navigate(`/train/session/${session.id}`);
    } finally {
      setBusy(false);
    }
  }

  async function removePlanned(id: string) {
    await api.delete(`/calendar/planned/${id}`);
    await load();
  }

  async function toggleDone(id: string, done: boolean) {
    await api.patch(`/calendar/planned/${id}`, { done });
    await load();
  }

  const day = days[selected];
  const monthPrefix = month.slice(0, 7);

  return (
    <div className="space-y-4">
      <PageTitle>Agenda</PageTitle>

      <div className="flex items-center justify-between">
        <button className="w-9 h-9 text-gray-600 text-2xl" onClick={() => shiftMonth(-1)} aria-label="Vorige maand">
          ‹
        </button>
        <div className="text-center">
          <p className="font-display font-bold text-lg first-letter:uppercase">{formatMonth(month)}</p>
          {monthPrefix !== today.slice(0, 7) && (
            <button
              className="text-xs text-brand-600 font-medium"
              onClick={() => {
                setMonth(today.slice(0, 7) + "-01");
                setSelected(today);
              }}
            >
              Naar vandaag
            </button>
          )}
        </div>
        <button className="w-9 h-9 text-gray-600 text-2xl" onClick={() => shiftMonth(1)} aria-label="Volgende maand">
          ›
        </button>
      </div>

      <div>
        <div className="grid grid-cols-7 gap-1 mb-1">
          {WEEKDAYS.map((w) => (
            <p key={w} className="text-center text-[11px] text-gray-400">
              {w}
            </p>
          ))}
        </div>
        <div className="grid grid-cols-7 gap-1">
          {cells.map((key) => {
            const d = days[key];
            const inMonth = key.startsWith(monthPrefix);
            const isSelected = key === selected;
            const trained = d?.sessions.length ?? 0;
            const open = d?.planned.filter((p) => !p.done).length ?? 0;
            const missed = key < today && open > 0;
            const doneAll = (d?.planned.length ?? 0) > 0 && open === 0;
            return (
              <button
                key={key}
                onClick={() => {
                  setSelected(key);
                  setAdding(false);
                }}
                className={`relative flex flex-col items-center justify-start rounded-lg pt-1.5 pb-1 h-14 border transition-colors ${
                  isSelected ? "bg-gray-900 border-gray-900 text-white" : "bg-surface border-gray-100 text-gray-800"
                } ${inMonth ? "" : "opacity-40"} ${key === today && !isSelected ? "!border-brand-500" : ""}`}
              >
                <span className="font-display font-bold text-sm leading-none">{Number(key.slice(8))}</span>
                <span className="flex gap-0.5 mt-1.5 h-2 items-center">
                  {trained > 0 && <span className="w-2 h-2 rounded-full bg-brand-500" />}
                  {open > 0 && (
                    <span
                      className={`w-2 h-2 rounded-full border-[1.5px] ${
                        isSelected ? "border-white" : missed ? "border-red-500 bg-red-100" : "border-brand-500"
                      }`}
                    />
                  )}
                  {doneAll && trained === 0 && <span className="w-2 h-2 rounded-full bg-gray-400" />}
                  {d?.foodLogged && trained === 0 && open === 0 && !doneAll && (
                    <span className={`w-1 h-1 rounded-full ${isSelected ? "bg-gray-300" : "bg-gray-300"}`} />
                  )}
                </span>
              </button>
            );
          })}
        </div>
        <p className="text-[11px] text-gray-400 mt-2 flex gap-4 justify-center">
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-brand-500" /> getraind
          </span>
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full border-[1.5px] border-brand-500" /> gepland
          </span>
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full border-[1.5px] border-red-500 bg-red-100" /> gemist
          </span>
        </p>
      </div>

      {loadError && <p className="text-sm text-red-500">Agenda laden mislukt. Probeer het zo nog eens.</p>}

      <Card>
        <h2 className="font-display font-bold text-lg first-letter:uppercase tracking-tight mb-3">{formatDayLong(selected)}</h2>

        <div className="space-y-2">
          {day?.sessions.map((s) => (
            <Link key={s.id} to={`/train/session/${s.id}`} className="flex items-center gap-3 rounded-lg bg-gray-50 px-3 py-2.5">
              <span className="w-7 h-7 rounded-full bg-brand-500 text-white flex items-center justify-center text-sm">✓</span>
              <div className="flex-1 min-w-0">
                <p className="font-medium text-sm truncate">{s.name}</p>
                <p className="text-xs text-gray-500">
                  {s.sets} sets · {s.volumeKg.toLocaleString("nl-NL")} kg
                  {s.prs > 0 && <span className="text-brand-600 font-semibold"> · {s.prs} PR</span>}
                </p>
              </div>
              <span className="text-gray-400">›</span>
            </Link>
          ))}

          {day?.planned.map((p) => (
            <div key={p.id} className="flex items-center gap-3 rounded-lg border border-gray-200 px-3 py-2.5">
              <span
                className={`w-7 h-7 rounded-full flex items-center justify-center text-sm shrink-0 ${
                  p.done ? "bg-gray-400 text-white" : "border-2 border-brand-500"
                }`}
              >
                {p.done && "✓"}
              </span>
              <div className="flex-1 min-w-0">
                <p className={`font-medium text-sm truncate ${p.done ? "text-gray-400 line-through" : ""}`}>{p.title}</p>
                <p className={`text-xs truncate ${!p.done && selected < today ? "text-red-500 font-medium" : "text-gray-500"}`}>
                  {!p.done && selected < today ? "Gemist" : p.programName ?? "Gepland"}
                </p>
              </div>
              {!p.done && selected < today && (
                <Button variant="secondary" className="!px-3 !py-1.5 text-xs" onClick={() => moveToToday(p.id)}>
                  Naar vandaag
                </Button>
              )}
              {!p.done && selected >= today &&
                (p.programDayId ? (
                  <Button className="!px-3 !py-1.5 text-xs" onClick={() => startPlanned(p.id)} disabled={busy}>
                    Start
                  </Button>
                ) : (
                  <Button variant="secondary" className="!px-3 !py-1.5 text-xs" onClick={() => toggleDone(p.id, true)}>
                    Klaar
                  </Button>
                ))}
              <button className="text-gray-400 text-sm px-1" onClick={() => removePlanned(p.id)} aria-label="Verwijder uit agenda">
                ✕
              </button>
            </div>
          ))}

          {!day?.sessions.length && !day?.planned.length && (
            <p className="text-sm text-gray-400">{selected < today ? "Geen training op deze dag." : "Nog niets gepland."}</p>
          )}
        </div>

        {adding ? (
          <div className="space-y-2 mt-3 pt-3 border-t border-gray-100">
            <select
              className="w-full px-3 py-2.5 rounded-lg border border-gray-200 bg-bg-raised text-gray-800"
              value={choice}
              onChange={(e) => setChoice(e.target.value)}
            >
              <option value="">Eigen titel (bv. cardio)…</option>
              {programs?.flatMap((p) =>
                p.days.map((d) => (
                  <option key={d.id} value={d.id}>
                    {p.name} · {d.name}
                  </option>
                ))
              )}
            </select>
            {!choice && <Input placeholder="Titel, bv. Cardio of Rustdag" value={customTitle} onChange={(e) => setCustomTitle(e.target.value)} />}
            <select
              className="w-full px-3 py-2.5 rounded-lg border border-gray-200 bg-bg-raised text-gray-800"
              value={repeatWeeks}
              onChange={(e) => setRepeatWeeks(Number(e.target.value))}
            >
              <option value={1}>Eenmalig</option>
              <option value={4}>Elke week, 4 weken</option>
              <option value={8}>Elke week, 8 weken</option>
              <option value={12}>Elke week, 12 weken</option>
            </select>
            <div className="flex gap-2">
              <Button className="flex-1" onClick={addPlan} disabled={busy || (!choice && !customTitle.trim())}>
                Plan in
              </Button>
              <Button variant="secondary" onClick={() => setAdding(false)}>
                Annuleer
              </Button>
            </div>
          </div>
        ) : (
          <Button variant="secondary" className="w-full mt-3" onClick={openAddForm}>
            + Training plannen
          </Button>
        )}
      </Card>

      {planning ? (
        <Card className="space-y-3">
          <h2 className="font-display font-bold text-lg">Meerdere weken inplannen</h2>
          <select
            className="w-full px-3 py-2.5 rounded-lg border border-gray-200 bg-bg-raised text-gray-800"
            value={weekProgram}
            onChange={(e) => setWeekProgram(e.target.value)}
          >
            {programs?.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name} ({p.days.length} dagen)
              </option>
            ))}
          </select>
          <div>
            <p className="text-xs font-medium text-gray-500 mb-1.5">Op welke dagen train je?</p>
            <div className="grid grid-cols-7 gap-1">
              {WEEKDAYS.map((w, i) => (
                <button
                  key={w}
                  type="button"
                  onClick={() => setWeekdays((cur) => (cur.includes(i) ? cur.filter((x) => x !== i) : [...cur, i]))}
                  className={`py-2 rounded-lg text-xs font-semibold border ${
                    weekdays.includes(i) ? "bg-gray-900 text-white border-gray-900" : "bg-surface text-gray-600 border-gray-200"
                  }`}
                >
                  {w}
                </button>
              ))}
            </div>
          </div>
          <select
            className="w-full px-3 py-2.5 rounded-lg border border-gray-200 bg-bg-raised text-gray-800"
            value={weekCount}
            onChange={(e) => setWeekCount(Number(e.target.value))}
          >
            {[1, 2, 4, 8, 12].map((n) => (
              <option key={n} value={n}>
                {n} {n === 1 ? "week" : "weken"}
              </option>
            ))}
          </select>
          <p className="text-xs text-gray-500">De trainingsdagen van je programma worden om de beurt over deze dagen verdeeld, vanaf vandaag.</p>
          <div className="flex gap-2">
            <Button className="flex-1" onClick={planWeeks} disabled={busy || !weekProgram || weekdays.length === 0}>
              Plan in
            </Button>
            <Button variant="secondary" onClick={() => setPlanning(false)}>
              Sluiten
            </Button>
          </div>
          {planMessage && <p className="text-sm text-center text-brand-600">{planMessage}</p>}
        </Card>
      ) : (
        <Button variant="secondary" className="w-full" onClick={openPlanning}>
          Meerdere weken inplannen
        </Button>
      )}

      <Card>
        <h2 className="font-display font-bold text-lg mb-3">Je consistentie</h2>
        <ConsistencyGrid />
        <Link to="/recap" className="block mt-3 text-sm text-brand-600 font-medium">
          Bekijk je maandoverzicht
        </Link>
      </Card>

      <p className="text-xs text-gray-500 text-center">
        Liever een hele week in één keer?{" "}
        <Link to="/coach" className="text-brand-600 font-medium">
          Vraag het de coach
        </Link>
      </p>
    </div>
  );
}
