import { useEffect, useMemo, useState } from "react";
import { Link, useLocation, useNavigate, useParams } from "react-router-dom";
import { api } from "../api/client.js";
import { WorkoutSummary as Summary } from "../api/types.js";
import { Button, Card, Spinner } from "../components/ui.js";

const CONFETTI_COLORS = ["#E5481A", "#161512", "#FF9A6E", "#F5C563", "#FFFFFF"];

function Confetti() {
  const pieces = useMemo(
    () =>
      Array.from({ length: 46 }, (_, i) => ({
        id: i,
        left: Math.random() * 100,
        color: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
        delay: Math.random() * 0.6,
        dur: 2.2 + Math.random() * 1.6,
        drift: Math.round((Math.random() - 0.5) * 160),
        round: i % 3 === 0,
      })),
    []
  );
  return (
    <>
      {pieces.map((p) => (
        <span
          key={p.id}
          className="confetti-piece"
          style={
            {
              left: `${p.left}%`,
              background: p.color,
              borderRadius: p.round ? "50%" : undefined,
              border: p.color === "#FFFFFF" ? "1px solid #E2DED5" : undefined,
              "--delay": `${p.delay}s`,
              "--dur": `${p.dur}s`,
              "--drift": `${p.drift}px`,
            } as React.CSSProperties
          }
        />
      ))}
    </>
  );
}

function useCountUp(target: number, durationMs = 900): number {
  const [value, setValue] = useState(0);
  useEffect(() => {
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) {
      setValue(target);
      return;
    }
    const start = performance.now();
    let raf = 0;
    const tick = (t: number) => {
      const p = Math.min(1, (t - start) / durationMs);
      setValue(Math.round(target * (1 - Math.pow(1 - p, 3))));
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, durationMs]);
  return value;
}

function Tile({ label, value, unit, delay }: { label: string; value: number; unit?: string; delay: string }) {
  const shown = useCountUp(value);
  return (
    <div className="animate-rise rounded-xl bg-surface border border-gray-100 shadow-card py-3.5 text-center" style={{ animationDelay: delay }}>
      <p className="font-display font-extrabold text-3xl leading-none tracking-tight">
        {shown.toLocaleString("nl-NL")}
        {unit && <span className="text-sm font-semibold text-gray-400 ml-0.5">{unit}</span>}
      </p>
      <p className="text-[11px] text-gray-500 mt-1.5">{label}</p>
    </div>
  );
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("nl-NL", { weekday: "short", day: "numeric", month: "short" });
}

export default function WorkoutSummaryPage() {
  const { id } = useParams<{ id: string }>();
  const location = useLocation();
  const navigate = useNavigate();
  const state = location.state as { summary?: Summary; fresh?: boolean } | null;
  const [summary, setSummary] = useState<Summary | null>(state?.summary ?? null);
  const [error, setError] = useState(false);
  const [asking, setAsking] = useState(false);
  const fresh = !!state?.fresh;

  useEffect(() => {
    if (summary || !id) return;
    api.get<Summary>(`/workouts/${id}/summary`).then(setSummary).catch(() => setError(true));
  }, [id, summary]);

  const span = summary ? summary.xp.nextLevelXp - summary.xp.levelStartXp : 1;
  const [barPct, setBarPct] = useState(0);
  useEffect(() => {
    if (!summary) return;
    const target = Math.max(0, Math.min(100, ((summary.xp.after - summary.xp.levelStartXp) / span) * 100));
    const t = setTimeout(() => setBarPct(target), 350);
    return () => clearTimeout(t);
  }, [summary, span]);

  const gained = useCountUp(summary?.xp.gained ?? 0, 1100);

  async function askCoach() {
    if (!summary || asking) return;
    setAsking(true);
    const lines = summary.exercises.map((e) => `- ${e.name}: ${e.sets.map((s) => `${s.reps}×${s.weight}`).join(", ")}`).join("\n");
    const message = `Ik ben net klaar met "${summary.session.name}" (${summary.session.durationMin} min, ${summary.totals.volumeKg} kg volume, ${summary.totals.sets} sets${
      summary.prs.length ? `, ${summary.prs.length} record(s)` : ""
    }).\n${lines}\n\nGeef me eerlijke feedback op deze training en zeg wat ik de volgende keer moet doen.`;
    try {
      await api.post("/ai/chat", { message });
    } catch {
      // the coach page still opens and shows whatever got through
    }
    navigate("/coach");
  }

  if (error) return <p className="text-sm text-red-500 pt-6">Samenvatting laden mislukt.</p>;
  if (!summary) return <Spinner />;

  const { totals, xp, week } = summary;
  const bestExercises = summary.exercises.filter((e) => e.e1rmDelta !== null && e.e1rmDelta > 0);

  return (
    <div className="space-y-4 pb-10">
      {fresh && <Confetti />}

      <div className="animate-rise">
        <p className="text-xs uppercase tracking-widest text-brand-600 font-semibold">Training klaar</p>
        <h1 className="font-display font-extrabold text-4xl tracking-tight leading-[1.05] mt-1">{summary.session.name}</h1>
        <p className="text-sm text-gray-500 mt-1">{formatDate(summary.session.date)}</p>
      </div>

      <p className="animate-rise text-[15px] font-medium text-gray-800" style={{ animationDelay: "0.1s" }}>
        {summary.coachLine}
      </p>

      <div className="grid grid-cols-2 gap-2.5">
        <Tile label="minuten" value={summary.session.durationMin} delay="0.15s" />
        <Tile label="volume (kg)" value={totals.volumeKg} delay="0.2s" />
        <Tile label="werksets" value={totals.sets} delay="0.25s" />
        <Tile label={totals.exercises === 1 ? "oefening" : "oefeningen"} value={totals.exercises} delay="0.3s" />
      </div>

      <Card className="!bg-gray-900 !border-gray-900 text-white animate-rise">
        {xp.leveledUp && (
          <div className="animate-pop mb-3 rounded-lg bg-brand-500 px-3 py-2.5 text-center">
            <p className="font-display font-extrabold text-lg leading-tight">Level up! Level {xp.levelAfter}</p>
            <p className="text-xs text-white/80">Je bent nu {xp.title}</p>
          </div>
        )}
        <div className="flex items-end justify-between">
          <div>
            <p className="text-xs uppercase tracking-widest text-gray-400">{xp.title}</p>
            <p className="font-display font-extrabold text-4xl leading-none mt-1">Level {xp.levelAfter}</p>
          </div>
          <p className="font-display font-extrabold text-3xl text-brand-400">+{gained} XP</p>
        </div>
        <div className="h-2.5 bg-white/15 rounded-full overflow-hidden mt-4">
          <div className="h-full bg-brand-400 rounded-full transition-all duration-[1400ms] ease-out" style={{ width: `${barPct}%` }} />
        </div>
        <p className="text-xs text-gray-400 mt-1.5">
          Nog {(xp.nextLevelXp - xp.after).toLocaleString("nl-NL")} XP tot level {xp.levelAfter + 1}
        </p>
      </Card>

      {summary.prs.length > 0 && (
        <div className="space-y-2">
          <h2 className="font-display font-bold text-lg">
            {summary.prs.length === 1 ? "Nieuw record" : `${summary.prs.length} nieuwe records`}
          </h2>
          {summary.prs.map((pr, i) => (
            <div
              key={i}
              className="animate-rise flex items-center gap-3 rounded-xl bg-brand-50 border border-brand-200 px-4 py-3"
              style={{ animationDelay: `${0.4 + i * 0.08}s` }}
            >
              <span className="text-[10px] font-bold tracking-wide text-white bg-brand-500 rounded px-1.5 py-0.5">PR</span>
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-sm truncate">{pr.exercise}</p>
                <p className="text-xs text-gray-600">
                  {pr.weight} kg × {pr.reps}
                </p>
              </div>
            </div>
          ))}
        </div>
      )}

      {summary.previous && summary.previous.deltaPct !== null && (
        <Card className="animate-rise">
          <p className="text-xs text-gray-500">Vergeleken met vorige keer ({formatDate(summary.previous.date)})</p>
          <p className="font-display font-bold text-2xl mt-0.5">
            <span className={summary.previous.deltaPct >= 0 ? "text-brand-600" : "text-gray-700"}>
              {summary.previous.deltaPct > 0 ? "+" : ""}
              {summary.previous.deltaPct}%
            </span>{" "}
            <span className="text-sm font-medium text-gray-500">volume</span>
          </p>
          {bestExercises.length > 0 && (
            <ul className="mt-2 space-y-1">
              {bestExercises.map((e) => (
                <li key={e.exerciseId} className="text-sm text-gray-700 flex justify-between">
                  <span>{e.name}</span>
                  <span className="text-brand-600 font-semibold">sterker (+{e.e1rmDelta} kg 1RM)</span>
                </li>
              ))}
            </ul>
          )}
        </Card>
      )}

      <Card className="animate-rise">
        <h2 className="font-display font-bold text-lg mb-2">Je sessie</h2>
        <div className="space-y-2.5">
          {summary.exercises.map((e) => (
            <div key={e.exerciseId}>
              <div className="flex justify-between text-sm">
                <span className="font-medium">{e.name}</span>
                <span className="text-gray-500">{e.volumeKg.toLocaleString("nl-NL")} kg</span>
              </div>
              <p className="text-xs text-gray-500">{e.sets.map((s) => `${s.reps}×${s.weight}`).join("  ·  ")}</p>
            </div>
          ))}
          {summary.exercises.length === 0 && <p className="text-sm text-gray-400">Geen werksets gelogd.</p>}
        </div>
      </Card>

      <Card className="animate-rise">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs text-gray-500">Deze week</p>
            <p className="font-display font-bold text-2xl">
              {week.sessions}/{week.target} <span className="text-sm font-medium text-gray-500">trainingen</span>
            </p>
          </div>
          <div className="flex gap-1.5">
            {Array.from({ length: week.target }).map((_, i) => (
              <span key={i} className={`w-3.5 h-3.5 rounded-full ${i < week.sessions ? "bg-brand-500" : "bg-gray-200"}`} />
            ))}
          </div>
        </div>
        {week.streakWeeks > 0 && (
          <p className="text-xs text-gray-500 mt-2">
            {week.streakWeeks} {week.streakWeeks === 1 ? "week" : "weken"} op rij getraind
          </p>
        )}
      </Card>

      <div className="space-y-2 pt-1">
        <Button className="w-full" onClick={askCoach} disabled={asking}>
          {asking ? "Even geduld..." : "Bespreek met de coach"}
        </Button>
        <Link to="/" className="block">
          <Button variant="secondary" className="w-full">
            Naar dashboard
          </Button>
        </Link>
        <Link to="/agenda" className="block text-center text-sm text-brand-600 font-medium pt-1">
          Plan je volgende training
        </Link>
      </div>
    </div>
  );
}
