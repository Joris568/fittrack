import { useCallback, useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { api } from "../api/client.js";
import { AiInsight, DashboardData, WeeklyReportContent } from "../api/types.js";
import { Card, Button, Spinner, PageTitle } from "../components/ui.js";
import { MiniBars, Ring, Sparkline } from "../components/charts.js";

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

export default function Dashboard() {
  const navigate = useNavigate();
  const [data, setData] = useState<DashboardData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [starting, setStarting] = useState(false);
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

      <WeekStrip data={data} onSelect={(d) => load(d)} />

      <LevelCard g={data.gamification} />
      <QuestsCard quests={data.gamification.quests} />

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
        {data.workouts.length > 0 ? (
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
          </div>
        ) : isToday && data.nextWorkout ? (
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
        )}
        {isToday && data.workouts.length > 0 && (
          <Link to="/train" className="block text-center text-sm text-brand-600 font-medium mt-3">
            Nog een training starten
          </Link>
        )}
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
            {p.weight.delta != null && (
              <p className="text-xs text-gray-500">
                {p.weight.delta > 0 ? "+" : ""}
                {p.weight.delta} kg (30 dgn)
              </p>
            )}
            <div className="mt-2">
              <Sparkline values={p.weight.series.map((s) => s.value)} />
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
          </Card>
        </div>
      </div>

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
