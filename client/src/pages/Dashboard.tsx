import { useCallback, useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { api } from "../api/client.js";
import { AiInsight, DashboardData, DeloadSignal, WeeklyCheckin, WeeklyReportContent } from "../api/types.js";
import { Card, Button, Spinner, PageTitle } from "../components/ui.js";
import { MiniBars, Ring, Sparkline } from "../components/charts.js";
import BodyMap from "../components/BodyMap.js";

const DAY_LABELS = ["Ma", "Di", "Wo", "Do", "Vr", "Za", "Zo"];

function addDays(dayKey: string, n: number): string {
  const d = new Date(`${dayKey}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

function formatDay(dayKey: string, today: string): string {
  if (dayKey === today) return "Vandaag";
  if (dayKey === addDays(today, -1)) return "Gisteren";
  return new Date(`${dayKey}T00:00:00Z`).toLocaleDateString("nl-NL", {
    weekday: "long",
    day: "numeric",
    month: "long",
    timeZone: "UTC",
  });
}

function daysBetween(fromKey: string, toKey: string): number {
  return Math.round((new Date(`${toKey}T00:00:00Z`).getTime() - new Date(`${fromKey}T00:00:00Z`).getTime()) / 86_400_000);
}

function SectionTitle({ children, action }: { children: React.ReactNode; action?: React.ReactNode }) {
  return (
    <div className="flex justify-between items-center mb-3">
      <h2 className="font-display font-bold text-lg tracking-tight">{children}</h2>
      {action}
    </div>
  );
}

function WeekStrip({ data, onSelect }: { data: DashboardData; onSelect: (day: string) => void }) {
  const first = data.strip[0].date;
  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <button className="w-8 h-8 text-gray-500 text-xl" onClick={() => onSelect(addDays(first, -7))} aria-label="Vorige week">
          ‹
        </button>
        <p className="text-sm font-medium text-gray-700 capitalize">{formatDay(data.selected, data.today)}</p>
        <button
          className="w-8 h-8 text-gray-500 text-xl disabled:opacity-30"
          disabled={addDays(first, 7) > data.today}
          onClick={() => onSelect(addDays(first, 7))}
          aria-label="Volgende week"
        >
          ›
        </button>
      </div>
      <div className="grid grid-cols-7 gap-1.5">
        {data.strip.map((d, i) => {
          const selected = d.date === data.selected;
          const future = d.date > data.today;
          return (
            <button
              key={d.date}
              disabled={future}
              onClick={() => onSelect(d.date)}
              className={`flex flex-col items-center rounded-lg py-2 border transition-colors ${
                selected ? "bg-gray-900 border-gray-900 text-white" : "bg-surface border-gray-200 text-gray-800"
              } ${future ? "opacity-40" : ""}`}
            >
              <span className={`text-[10px] ${selected ? "text-gray-300" : "text-gray-500"}`}>{DAY_LABELS[i]}</span>
              <span className="font-display font-bold text-base leading-tight">{Number(d.date.slice(8))}</span>
              <span className="flex gap-0.5 h-1.5 mt-1">
                {d.trained && <span className="w-1.5 h-1.5 rounded-full bg-brand-500" />}
                {d.logged && <span className={`w-1.5 h-1.5 rounded-full ${selected ? "bg-gray-300" : "bg-gray-400"}`} />}
              </span>
            </button>
          );
        })}
      </div>
      <p className="text-[11px] text-gray-400 mt-1.5 flex gap-3 justify-center">
        <span className="flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-brand-500" /> getraind</span>
        <span className="flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-gray-400" /> eten gelogd</span>
      </p>
    </div>
  );
}

function LevelCard({ g }: { g: DashboardData["gamification"] }) {
  const span = g.nextLevelXp - g.levelStartXp;
  const pct = span > 0 ? Math.round(((g.xp - g.levelStartXp) / span) * 100) : 0;
  return (
    <Card className="!bg-gray-900 !border-gray-900 text-white">
      <div className="flex items-end justify-between">
        <div>
          <p className="text-xs uppercase tracking-widest text-gray-400">{g.title}</p>
          <p className="font-display font-extrabold text-5xl leading-none mt-1">Level {g.level}</p>
        </div>
        <p className="text-sm text-gray-300 text-right">
          <span className="font-display font-bold text-xl text-white">{g.xp.toLocaleString("nl-NL")}</span> XP
        </p>
      </div>
      <div className="h-2 bg-white/15 rounded-full overflow-hidden mt-4">
        <div className="h-full bg-brand-400 rounded-full transition-all duration-700" style={{ width: `${pct}%` }} />
      </div>
      <p className="text-xs text-gray-400 mt-1.5">
        Nog {(g.nextLevelXp - g.xp).toLocaleString("nl-NL")} XP tot level {g.level + 1}
      </p>
      <div className="grid grid-cols-4 gap-2 mt-4 text-center">
        {[
          { v: g.streakWeeks, l: g.streakWeeks === 1 ? "week op rij" : "weken op rij" },
          { v: g.foodStreakDays, l: g.foodStreakDays === 1 ? "dag eten" : "dagen eten" },
          { v: g.totalPRs, l: "records" },
          { v: g.badges, l: "badges" },
        ].map((s) => (
          <div key={s.l} className="rounded-lg bg-white/10 py-2">
            <p className="font-display font-bold text-xl leading-none">{s.v}</p>
            <p className="text-[10px] text-gray-300 mt-1">{s.l}</p>
          </div>
        ))}
      </div>
      <Link to="/settings" className="block mt-3 text-center text-xs text-gray-300 underline underline-offset-2">
        Alle badges bekijken
      </Link>
    </Card>
  );
}

function QuestsCard({ quests }: { quests: DashboardData["gamification"]["quests"] }) {
  const done = quests.filter((q) => q.done).length;
  return (
    <Card>
      <SectionTitle action={<span className="text-xs text-gray-500">{done}/{quests.length} gehaald</span>}>
        Weekopdrachten
      </SectionTitle>
      <div className="space-y-3.5">
        {quests.map((q) => (
          <div key={q.key}>
            <div className="flex justify-between items-center text-sm mb-1">
              <span className={q.done ? "text-gray-400 line-through" : "text-gray-800"}>{q.title}</span>
              <span className={`text-xs font-semibold ${q.done ? "text-brand-600" : "text-gray-400"}`}>
                {q.done ? `+${q.xp} XP` : `${q.progress}/${q.target}`}
              </span>
            </div>
            <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-700 ${q.done ? "bg-brand-500" : "bg-gray-900"}`}
                style={{ width: `${(q.progress / q.target) * 100}%` }}
              />
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
}

function WeeklyCheckinCard({ data, onDone }: { data: WeeklyCheckin; onDone: () => void }) {
  const [busy, setBusy] = useState(false);
  if (!data.available || data.hidden || !data.result || data.result.status === "te-weinig-data") return null;
  const r = data.result;
  const g = data.currentGoal!;
  const n = data.newGoal;

  async function handle(apply: boolean) {
    setBusy(true);
    try {
      await api.post("/checkin/weekly/handle", { apply });
      onDone();
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card>
      <SectionTitle action={<span className="text-xs text-gray-500">deze week</span>}>Weekcheck</SectionTitle>
      <p className="text-sm text-gray-700">{r.text}</p>
      {n && (
        <div className="mt-3 rounded-lg bg-gray-50 px-3 py-2.5 text-sm">
          <p>
            <span className="text-gray-500">Nu</span> {g.calories} kcal <span className="text-gray-400">→</span>{" "}
            <span className="font-display font-bold">{n.calories} kcal</span>
          </p>
          <p className="text-xs text-gray-500 mt-0.5">
            eiwit {n.proteinGrams} g · koolhydraten {n.carbsGrams} g · vet {n.fatGrams} g
          </p>
        </div>
      )}
      <div className="flex gap-2 mt-3">
        {n ? (
          <>
            <Button className="flex-1" onClick={() => handle(true)} disabled={busy}>
              Pas toe
            </Button>
            <Button variant="secondary" onClick={() => handle(false)} disabled={busy}>
              Laat zo
            </Button>
          </>
        ) : (
          <Button variant="secondary" className="w-full" onClick={() => handle(false)} disabled={busy}>
            Top, doorgaan
          </Button>
        )}
      </div>
    </Card>
  );
}

function DeloadCard({ signal, onAsk }: { signal: DeloadSignal; onAsk: () => void }) {
  const [hidden, setHidden] = useState(() => {
    try {
      return Number(localStorage.getItem("deload-dismissed") ?? 0) > Date.now();
    } catch {
      return false;
    }
  });
  if (!signal.suggested || hidden) return null;
  return (
    <Card className="!border-amber-200 !bg-amber-50">
      <h2 className="font-display font-bold text-lg text-amber-900">Tijd voor een rustigere week?</h2>
      <ul className="mt-1.5 space-y-0.5">
        {signal.reasons.map((r) => (
          <li key={r} className="text-sm text-amber-900">
            · {r}
          </li>
        ))}
      </ul>
      <p className="text-xs text-amber-800 mt-2">Een deload (ongeveer de helft van de sets) laat je herstellen, daarna ga je vaak weer sterker door.</p>
      <div className="flex gap-2 mt-3">
        <Button className="flex-1" onClick={onAsk}>
          Laat de coach een deload plannen
        </Button>
        <Button
          variant="secondary"
          onClick={() => {
            try {
              localStorage.setItem("deload-dismissed", String(Date.now() + 7 * 86_400_000));
            } catch {
              // ignore
            }
            setHidden(true);
          }}
        >
          Niet nu
        </Button>
      </div>
    </Card>
  );
}

export default function Dashboard() {
  const navigate = useNavigate();
  const [data, setData] = useState<DashboardData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [starting, setStarting] = useState(false);
  const [checkin, setCheckin] = useState<WeeklyCheckin | null>(null);
  const [deload, setDeload] = useState<DeloadSignal | null>(null);
  const [advice, setAdvice] = useState<AiInsight<{ text: string }> | null>(null);
  const [adviceLoading, setAdviceLoading] = useState(false);
  const [report, setReport] = useState<AiInsight<WeeklyReportContent> | null>(null);
  const [reportLoading, setReportLoading] = useState(true);

  const load = useCallback(async (date?: string) => {
    try {
      const params = new URLSearchParams({ tz: String(new Date().getTimezoneOffset()) });
      if (date) params.set("date", date);
      setData(await api.get<DashboardData>(`/dashboard?${params}`));
      setError(null);
    } catch {
      setError("Dashboard laden mislukt. Probeer het zo nog eens.");
    }
  }, []);

  useEffect(() => {
    load();
    api.get<WeeklyCheckin>("/checkin/weekly").then(setCheckin).catch(() => {});
    api.get<DeloadSignal>("/checkin/deload").then(setDeload).catch(() => {});
    api.get<AiInsight<{ text: string }> | null>("/ai/nutrition-advice/latest").then(setAdvice).catch(() => {});
    api
      .get<AiInsight<WeeklyReportContent>>("/ai/weekly-report/latest")
      .then(setReport)
      .catch(() => {
        // No report yet (e.g. AI not configured) — dashboard still renders.
      })
      .finally(() => setReportLoading(false));
  }, [load]);

  async function generateAdvice() {
    setAdviceLoading(true);
    try {
      setAdvice(await api.post<AiInsight<{ text: string }>>("/ai/nutrition-advice/generate"));
    } finally {
      setAdviceLoading(false);
    }
  }

  async function startPlanned(id: string) {
    setStarting(true);
    try {
      const session = await api.post<{ id: string }>(`/calendar/planned/${id}/start`);
      navigate(`/train/session/${session.id}`);
    } catch {
      setStarting(false);
    }
  }

  async function moveToToday(id: string) {
    await api.patch(`/calendar/planned/${id}`, { date: data?.today });
    await load(data?.selected);
  }

  async function startWorkout(dayId: string) {
    setStarting(true);
    try {
      const session = await api.post<{ id: string }>("/workouts", { programDayId: dayId });
      navigate(`/train/session/${session.id}`);
    } catch {
      setStarting(false);
    }
  }

  if (error && !data) return <p className="text-sm text-red-500 pt-6">{error}</p>;
  if (!data) return <Spinner />;

  const { nutrition: n, progress: p } = data;
  const isToday = data.selected === data.today;

  return (
    <div className="space-y-4">
      <PageTitle>Dashboard</PageTitle>

      {data.profileMissing && (
        <Link to="/profile" className="block rounded-xl border border-brand-200 bg-brand-50 px-4 py-3">
          <p className="font-semibold text-sm text-brand-700">Maak je profiel af (1 minuut)</p>
          <p className="text-xs text-gray-600 mt-0.5">Dan klopt je onderhoud en kan de coach echt op jou afstemmen.</p>
        </Link>
      )}

      {p.photos.lastDate && daysBetween(p.photos.lastDate, data.today) >= 28 && (
        <Link to="/coach" className="block rounded-xl border border-gray-200 bg-surface px-4 py-3">
          <p className="font-semibold text-sm">Tijd voor je maandelijkse foto-check</p>
          <p className="text-xs text-gray-500 mt-0.5">Je laatste foto is {daysBetween(p.photos.lastDate, data.today)} dagen oud. Zelfde plek, zelfde licht, dan zie je pas echt verschil.</p>
        </Link>
      )}

      {Number(data.today.slice(8)) <= 7 && (
        <Link to="/recap" className="block rounded-xl border border-brand-200 bg-brand-50 px-4 py-3">
          <p className="font-semibold text-sm text-brand-700">Je maandoverzicht staat klaar</p>
          <p className="text-xs text-gray-600 mt-0.5">Bekijk wat je vorige maand hebt getild en je beste records.</p>
        </Link>
      )}

      <WeekStrip data={data} onSelect={(d) => load(d)} />

      <LevelCard g={data.gamification} />
      <QuestsCard quests={data.gamification.quests} />

      {checkin && <WeeklyCheckinCard data={checkin} onDone={() => api.get<WeeklyCheckin>("/checkin/weekly").then(setCheckin)} />}
      {deload && (
        <DeloadCard
          signal={deload}
          onAsk={async () => {
            const why = deload.reasons.join("; ");
            await api.post("/ai/chat", { message: `Ik krijg deload-signalen (${why}). Maak een deload-week voor me: pas mijn actieve programma aan voor één week met ongeveer de helft van de sets en plan het in mijn agenda. Zeg wat je gedaan hebt.` }).catch(() => {});
            navigate("/coach");
          }}
        />
      )}

      <Card>
        <SectionTitle
          action={
            <Link to="/eat" className="text-sm text-brand-600 font-medium">
              Eten loggen
            </Link>
          }
        >
          Voeding
        </SectionTitle>
        {n.goal ? (
          <div className="grid grid-cols-4 gap-1">
            <Ring label="Calorieën" value={n.totals.calories} goal={n.goal.calories} unit="" />
            <Ring label="Eiwit" value={n.totals.protein} goal={n.goal.proteinGrams} unit="g" />
            <Ring label="Koolh." value={n.totals.carbs} goal={n.goal.carbsGrams} unit="g" />
            <Ring label="Vet" value={n.totals.fat} goal={n.goal.fatGrams} unit="g" />
          </div>
        ) : (
          <div className="text-sm">
            <p className="text-gray-600 mb-2">Nog geen voedingsdoel. {n.totals.calories} kcal gelogd.</p>
            <Link to="/eat/goals" className="text-brand-600 font-medium">
              Stel een voedingsdoel in
            </Link>
          </div>
        )}
      </Card>

      <Card>
        <SectionTitle>Training</SectionTitle>
        {(data.workouts.length > 0 || data.planned.length > 0) && (
          <div className="space-y-2">
            {data.workouts.map((w) => (
              <Link key={w.id} to={`/train/session/${w.id}`} className="flex items-center gap-3 rounded-lg bg-gray-50 px-3 py-2.5">
                <span className="w-7 h-7 rounded-full bg-brand-500 text-white flex items-center justify-center text-sm">✓</span>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-sm truncate">{w.name}</p>
                  <p className="text-xs text-gray-500">
                    {w.sets} sets · {w.volumeKg.toLocaleString("nl-NL")} kg volume
                    {w.prs > 0 && <span className="text-brand-600 font-semibold"> · {w.prs} PR</span>}
                  </p>
                </div>
                <span className="text-gray-400">›</span>
              </Link>
            ))}
            {data.planned.map((p) => (
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
                  <p className="text-xs text-gray-500 truncate">Gepland{p.programName ? ` · ${p.programName}` : ""}</p>
                </div>
                {!p.done && p.startable && (
                  <Button className="!px-3 !py-1.5 text-xs" onClick={() => startPlanned(p.id)} disabled={starting}>
                    {starting ? "..." : "Start"}
                  </Button>
                )}
              </div>
            ))}
          </div>
        )}
        {isToday && p.missed.length > 0 && (
          <div className="mb-3 rounded-lg bg-amber-50 px-3 py-2.5">
            <p className="text-xs font-semibold text-amber-800 mb-1.5">
              {p.missed.length === 1 ? "1 geplande training gemist" : `${p.missed.length} geplande trainingen gemist`}
            </p>
            {p.missed.slice(0, 2).map((m) => (
              <div key={m.id} className="flex items-center justify-between gap-2 text-sm py-0.5">
                <span className="truncate text-gray-700">
                  {m.title} <span className="text-xs text-gray-400">({formatDay(m.date, data.today)})</span>
                </span>
                <button className="text-xs font-medium text-brand-600 shrink-0" onClick={() => moveToToday(m.id)}>
                  Naar vandaag
                </button>
              </div>
            ))}
          </div>
        )}
        {data.workouts.length === 0 && data.planned.length === 0 && (
          isToday && data.nextWorkout ? (
            <div className="flex items-center gap-3">
              <div className="flex-1 min-w-0">
                <p className="text-xs text-gray-500">Volgende training</p>
                <p className="font-display font-bold text-lg truncate">{data.nextWorkout.dayName}</p>
                <p className="text-xs text-gray-500 truncate">
                  {data.nextWorkout.programName} · {data.nextWorkout.exerciseCount} oefeningen
                </p>
              </div>
              <Button onClick={() => startWorkout(data.nextWorkout!.dayId)} disabled={starting}>
                {starting ? "..." : "Start"}
              </Button>
            </div>
          ) : (
            <p className="text-sm text-gray-500">
              {isToday ? "Nog geen programma." : "Geen training op deze dag."}{" "}
              <Link to="/train" className="text-brand-600 font-medium">
                {isToday ? "Naar trainen" : "Alle trainingen"}
              </Link>
            </p>
          )
        )}
        <div className="flex justify-between mt-3 text-sm font-medium">
          <Link to="/agenda" className="text-brand-600">
            Agenda openen
          </Link>
          {isToday && data.workouts.length > 0 && (
            <Link to="/train" className="text-brand-600">
              Nog een training starten
            </Link>
          )}
        </div>
      </Card>

      <div>
        <SectionTitle>Mijn voortgang</SectionTitle>
        <div className="grid grid-cols-2 gap-3">
          <Card className="!p-3.5">
            <p className="text-xs text-gray-500">Gewicht</p>
            <p className="font-display font-bold text-2xl mt-1">
              {p.weight.latest != null ? p.weight.latest : "–"}
              <span className="text-sm font-medium text-gray-400"> kg</span>
            </p>
            {p.weight.ratePerWeek != null ? (
              <p className="text-xs text-gray-500">
                {p.weight.ratePerWeek > 0 ? "+" : ""}
                {p.weight.ratePerWeek} kg/week
                {p.weight.rateStatus && (
                  <span
                    className={`ml-1.5 font-semibold ${p.weight.rateStatus === "op-schema" ? "text-brand-600" : "text-amber-700"}`}
                  >
                    {p.weight.rateStatus === "op-schema" ? "op schema" : p.weight.rateStatus === "te-snel" ? "te snel" : "te traag"}
                  </span>
                )}
              </p>
            ) : (
              p.weight.delta != null && (
                <p className="text-xs text-gray-500">
                  {p.weight.delta > 0 ? "+" : ""}
                  {p.weight.delta} kg (30 dgn)
                </p>
              )
            )}
            <div className="mt-2">
              <Sparkline values={(p.weight.trend.length >= 2 ? p.weight.trend : p.weight.series).map((s) => s.value)} />
            </div>
            <Link to="/settings" className="text-xs text-brand-600 font-medium">
              {p.weight.latest != null ? "Loggen" : "Gewicht loggen"}
            </Link>
          </Card>

          <Card className="!p-3.5">
            <p className="text-xs text-gray-500">Calorieën (7 dgn)</p>
            <p className="font-display font-bold text-2xl mt-1">
              {p.calories.average != null ? p.calories.average : "–"}
              <span className="text-sm font-medium text-gray-400"> gem.</span>
            </p>
            <p className="text-xs text-gray-500">{n.goal ? `doel ${n.goal.calories}` : "geen doel"}</p>
            <div className="mt-2">
              <MiniBars values={p.calories.series.map((s) => s.value)} />
            </div>
          </Card>

          <Card className="!p-3.5">
            <p className="text-xs text-gray-500">Trainingen per week</p>
            <p className="font-display font-bold text-2xl mt-1">
              {p.sessionsPerWeek[p.sessionsPerWeek.length - 1].value}
              <span className="text-sm font-medium text-gray-400"> deze week</span>
            </p>
            <p className="text-xs text-gray-500">laatste 8 weken</p>
            <div className="mt-2">
              <MiniBars values={p.sessionsPerWeek.map((s) => s.value)} />
            </div>
          </Card>

          <Card className="!p-3.5">
            <p className="text-xs text-gray-500">V-taper (schouders / taille)</p>
            {p.vtaper ? (
              <>
                <p className="font-display font-bold text-2xl mt-1">
                  {p.vtaper.ratio.toFixed(2)}
                  <span className="text-sm font-medium text-gray-400"> / {p.vtaper.target}</span>
                </p>
                <p className="text-xs text-gray-500">
                  {p.vtaper.level}
                  {p.vtaper.delta != null && p.vtaper.delta !== 0 && (
                    <span className={p.vtaper.delta > 0 ? "text-brand-600 font-semibold" : "text-gray-500"}>
                      {" "}
                      · {p.vtaper.delta > 0 ? "+" : ""}
                      {p.vtaper.delta}
                    </span>
                  )}
                </p>
                <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden mt-2">
                  <div className="h-full bg-brand-500 rounded-full" style={{ width: `${Math.min(100, (p.vtaper.ratio / p.vtaper.target) * 100)}%` }} />
                </div>
                {p.vtaper.series.length > 1 && (
                  <div className="mt-2">
                    <Sparkline values={p.vtaper.series.map((s) => s.value)} />
                  </div>
                )}
              </>
            ) : (
              <>
                <p className="text-sm text-gray-500 mt-1.5">Meet je schouders en taille, dan zie je hier je V-taper score.</p>
                <Link to="/settings" className="text-xs text-brand-600 font-medium">
                  Metingen invullen
                </Link>
              </>
            )}
          </Card>

          <Card className="!p-3.5 col-span-2">
            <p className="text-xs text-gray-500">Foto&apos;s</p>
            {p.photos.latest.length > 0 ? (
              <div className="grid grid-cols-3 gap-1 mt-2">
                {p.photos.latest.map((ph) => (
                  <img key={ph.id} src={ph.imageData} alt="Voortgangsfoto" className="aspect-[3/4] w-full object-cover rounded-md" />
                ))}
              </div>
            ) : (
              <p className="text-sm text-gray-400 mt-2">Nog geen foto&apos;s</p>
            )}
            <Link to="/coach" className="block text-xs text-brand-600 font-medium mt-2">
              {p.photos.count > 0 ? `${p.photos.count} foto's · laat de coach kijken` : "Foto uploaden in de coach"}
            </Link>
            {p.photos.count >= 2 && (
              <Link to="/photos" className="block text-xs text-brand-600 font-medium mt-1">
                Voor/na vergelijken
              </Link>
            )}
          </Card>
        </div>
      </div>

      <Card>
        <SectionTitle action={<span className="text-xs text-gray-500">laatste 7 dagen</span>}>Sets per spiergroep</SectionTitle>
        <BodyMap volume={p.muscleVolume} priorities={p.priorities} />
        {p.muscleVolume.length === 0 ? (
          <p className="text-sm text-gray-400 mt-3">Nog geen sets gelogd deze week.</p>
        ) : (
          <div className="space-y-2.5 mt-4">
            {p.muscleVolume.map((m) => (
              <div key={m.group}>
                <div className="flex justify-between text-xs mb-1">
                  <span className="text-gray-700">{m.group}</span>
                  <span className="text-gray-500">{m.sets} sets</span>
                </div>
                <div className="relative h-2 bg-gray-100 rounded-full overflow-hidden">
                  <div className="absolute inset-y-0 bg-brand-100" style={{ left: `${(6 / 18) * 100}%`, width: `${(6 / 18) * 100}%` }} />
                  <div
                    className={`absolute inset-y-0 left-0 rounded-full ${m.sets >= 6 ? "bg-brand-500" : "bg-gray-400"}`}
                    style={{ width: `${Math.min(100, (m.sets / 18) * 100)}%` }}
                  />
                </div>
              </div>
            ))}
            <p className="text-[11px] text-gray-400">De lichtoranje zone is 6-12 harde sets per week. {p.priorities.length > 0 ? `Je focus (${p.priorities.join(", ")}) mag naar 12 of meer.` : "Kies je focus-spieren in je profiel."}</p>
          </div>
        )}
      </Card>

      <Card>
        <SectionTitle
          action={
            <Button variant="ghost" className="!px-2 !py-1 text-xs" onClick={generateAdvice} disabled={adviceLoading}>
              {adviceLoading ? "..." : "Ververs"}
            </Button>
          }
        >
          AI voedingsadvies
        </SectionTitle>
        {advice ? (
          <p className="text-sm text-gray-700 whitespace-pre-line">{advice.content.text}</p>
        ) : (
          <p className="text-sm text-gray-400">Nog geen advies vandaag — vraag het aan.</p>
        )}
      </Card>

      <Card>
        <SectionTitle>Wekelijks rapport</SectionTitle>
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
    </div>
  );
}
