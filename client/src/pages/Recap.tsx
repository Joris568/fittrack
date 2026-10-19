import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../api/client.js";
import { MonthlyRecap } from "../api/types.js";
import { Card, Spinner } from "../components/ui.js";
import ShareButton from "../components/ShareButton.js";

function Big({ value, label, delay }: { value: string; label: string; delay: string }) {
  return (
    <div className="animate-rise rounded-xl bg-surface border border-gray-100 shadow-card py-4 text-center" style={{ animationDelay: delay }}>
      <p className="font-display font-extrabold text-3xl leading-none tracking-tight">{value}</p>
      <p className="text-[11px] text-gray-500 mt-1.5">{label}</p>
    </div>
  );
}

export default function Recap() {
  const [month, setMonth] = useState<string | undefined>(undefined);
  const [data, setData] = useState<MonthlyRecap | null>(null);

  useEffect(() => {
    setData(null);
    api.get<MonthlyRecap>(`/recap${month ? `?month=${month}` : ""}`).then(setData);
  }, [month]);

  if (!data) return <Spinner />;
  const t = data.totals;
  const nf = (n: number) => n.toLocaleString("nl-NL");

  const lines: string[] = [];
  if (data.comparison) lines.push(`Je tilde ${nf(t.volumeKg)} kg: dat is ${data.comparison.count} ${data.comparison.thing}.`);
  if (data.prs.top[0]) lines.push(`Beste record: ${data.prs.top[0].exercise}, ${data.prs.top[0].weight} kg × ${data.prs.top[0].reps}.`);
  if (data.topExercise) lines.push(`Meest getraind: ${data.topExercise.name} (${data.topExercise.sets} sets).`);

  return (
    <div className="space-y-4 pb-8">
      <div className="flex items-center justify-between">
        <button className="w-9 h-9 text-gray-600 text-2xl" onClick={() => setMonth(data.prevMonth)} aria-label="Vorige maand">
          ‹
        </button>
        <p className="text-xs uppercase tracking-widest text-brand-600 font-semibold">Maandoverzicht</p>
        <button className="w-9 h-9 text-gray-600 text-2xl disabled:opacity-30" disabled={!data.nextMonth} onClick={() => setMonth(data.nextMonth ?? undefined)} aria-label="Volgende maand">
          ›
        </button>
      </div>

      <h1 className="font-display font-extrabold text-4xl tracking-tight leading-[1.05] first-letter:uppercase animate-rise">{data.label}</h1>
      {data.isCurrent && <p className="text-xs text-gray-500 -mt-2">Tot nu toe deze maand.</p>}

      {!data.hasData ? (
        <Card>
          <p className="text-sm text-gray-600">Geen trainingen of voeding gelogd in deze maand.</p>
        </Card>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-2.5">
            <Big value={String(t.sessions)} label="trainingen" delay="0.05s" />
            <Big value={String(t.sets)} label="werksets" delay="0.1s" />
            <Big value={nf(t.volumeKg)} label="kg getild" delay="0.15s" />
            <Big value={String(data.prs.count)} label={data.prs.count === 1 ? "record" : "records"} delay="0.2s" />
          </div>

          {data.comparison && (
            <Card className="animate-rise !bg-gray-900 !border-gray-900 text-white">
              <p className="text-xs uppercase tracking-widest text-gray-400">Om je een idee te geven</p>
              <p className="font-display font-bold text-2xl mt-1 leading-tight">
                {nf(t.volumeKg)} kg is {data.comparison.count} {data.comparison.thing}.
              </p>
            </Card>
          )}

          {data.prs.top.length > 0 && (
            <div className="space-y-2">
              <h2 className="font-display font-bold text-lg">Beste records</h2>
              {data.prs.top.map((pr, i) => (
                <div key={i} className="animate-rise flex items-center gap-3 rounded-xl bg-brand-50 border border-brand-200 px-4 py-3" style={{ animationDelay: `${0.25 + i * 0.07}s` }}>
                  <span className="text-[10px] font-bold tracking-wide text-white bg-brand-500 rounded px-1.5 py-0.5">PR</span>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-sm truncate">{pr.exercise}</p>
                    <p className="text-xs text-gray-600">{pr.weight} kg × {pr.reps}</p>
                  </div>
                </div>
              ))}
            </div>
          )}

          <Card className="animate-rise space-y-2.5">
            <h2 className="font-display font-bold text-lg">Jouw maand in het kort</h2>
            {[
              data.topExercise && ["Meest getrainde oefening", `${data.topExercise.name} (${data.topExercise.sets} sets)`],
              data.topMuscle && ["Meest getrainde spiergroep", `${data.topMuscle.group} (${data.topMuscle.sets} sets)`],
              ["Trainingsdagen", String(t.trainedDays)],
              t.avgDurationMin && ["Gemiddelde duur", `${t.avgDurationMin} min`],
              data.bestWeek && ["Beste week", `${nf(data.bestWeek.volumeKg)} kg in ${data.bestWeek.sessions} trainingen`],
              data.body && ["Gewicht", `${data.body.end} kg (${data.body.change > 0 ? "+" : ""}${data.body.change} kg)`],
              data.nutrition && ["Voeding", `gem. ${nf(data.nutrition.avgCalories)} kcal en ${data.nutrition.avgProtein} g eiwit (${data.nutrition.loggedDays} dagen gelogd)`],
              data.photos > 0 && ["Voortgangsfoto's", String(data.photos)],
            ]
              .filter(Boolean)
              .map((row) => {
                const [k, v] = row as [string, string];
                return (
                  <div key={k} className="flex justify-between gap-3 text-sm">
                    <span className="text-gray-500">{k}</span>
                    <span className="font-medium text-right">{v}</span>
                  </div>
                );
              })}
          </Card>

          <ShareButton
            filename={`fittrack-${data.month}.png`}
            spec={{
              eyebrow: "Maandoverzicht",
              title: data.label.charAt(0).toUpperCase() + data.label.slice(1),
              stats: [
                { value: String(t.sessions), label: "trainingen" },
                { value: nf(t.volumeKg), label: "kg getild" },
                { value: String(t.sets), label: "werksets" },
                { value: String(data.prs.count), label: "records" },
              ],
              lines,
            }}
          />
        </>
      )}

      <Link to="/" className="block text-center text-sm text-brand-600 font-medium">
        Terug naar dashboard
      </Link>
    </div>
  );
}
