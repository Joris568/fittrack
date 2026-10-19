import { useEffect, useState } from "react";
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { api } from "../api/client.js";
import { ExerciseGuideResponse, ExerciseProgress } from "../api/types.js";
import { Spinner } from "./ui.js";

/** Bottom sheet with how an exercise is done and how the user's own lifts on it are
 * progressing. The explanation is cached server-side, so reopening is instant. */
export default function ExerciseSheet({
  exerciseId,
  name,
  onClose,
}: {
  exerciseId: string;
  name: string;
  onClose: () => void;
}) {
  const [tab, setTab] = useState<"uitleg" | "voortgang">("uitleg");
  const [guide, setGuide] = useState<ExerciseGuideResponse | null>(null);
  const [progress, setProgress] = useState<ExerciseProgress | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    api.get<ExerciseGuideResponse>(`/exercises/${exerciseId}/guide`).then(setGuide).catch(() => setFailed(true));
    api.get<ExerciseProgress>(`/exercises/${exerciseId}/progress`).then(setProgress).catch(() => {});
  }, [exerciseId]);

  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

  const g = guide?.guide;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center" role="dialog" aria-modal="true" aria-label={name}>
      <button className="absolute inset-0 bg-gray-900/50" onClick={onClose} aria-label="Sluiten" />
      <div className="relative w-full max-w-lg max-h-[88vh] overflow-y-auto bg-bg rounded-t-2xl sm:rounded-2xl px-4 pt-3 pb-8 animate-sheet">
        <div className="w-10 h-1 rounded-full bg-gray-300 mx-auto mb-3" />
        <div className="flex items-start justify-between gap-3 mb-3">
          <div>
            <h2 className="font-display font-bold text-xl tracking-tight">{name}</h2>
            {guide && (
              <p className="text-xs text-gray-500 mt-0.5">
                {guide.exercise.muscleGroup}
                {guide.exercise.equipment ? ` · ${guide.exercise.equipment}` : ""}
              </p>
            )}
          </div>
          <button className="text-gray-400 text-lg leading-none px-1" onClick={onClose} aria-label="Sluiten">
            ✕
          </button>
        </div>

        <div className="grid grid-cols-2 gap-1.5 mb-4">
          {(["uitleg", "voortgang"] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`rounded-lg py-2 text-sm font-semibold border ${tab === t ? "bg-gray-900 text-white border-gray-900" : "bg-surface text-gray-600 border-gray-200"}`}
            >
              {t === "uitleg" ? "Uitleg" : "Jouw voortgang"}
            </button>
          ))}
        </div>

        {tab === "uitleg" && (
          <div className="space-y-4">
            {!guide && !failed && <Spinner />}
            {failed && <p className="text-sm text-gray-500">Uitleg laden lukt nu niet (geen verbinding?).</p>}
            {guide && !g && (
              <p className="text-sm text-gray-500">
                Voor deze oefening is nog geen uitleg beschikbaar. Bekijk de video hieronder.
              </p>
            )}
            {g && (
              <>
                <div className="flex flex-wrap gap-1.5">
                  {g.muscles.primary.map((m) => (
                    <span key={m} className="px-2.5 py-1 rounded-full bg-brand-50 text-brand-700 text-xs font-semibold">
                      {m}
                    </span>
                  ))}
                  {g.muscles.secondary.map((m) => (
                    <span key={m} className="px-2.5 py-1 rounded-full bg-gray-100 text-gray-600 text-xs">
                      {m}
                    </span>
                  ))}
                </div>

                <section>
                  <h3 className="font-semibold text-sm mb-2">Zo doe je het</h3>
                  <ol className="space-y-2">
                    {g.steps.map((s, i) => (
                      <li key={i} className="flex gap-2.5 text-sm text-gray-700">
                        <span className="w-5 h-5 shrink-0 rounded-full bg-gray-900 text-white text-[11px] font-bold flex items-center justify-center mt-0.5">
                          {i + 1}
                        </span>
                        <span>{s}</span>
                      </li>
                    ))}
                  </ol>
                </section>

                <section>
                  <h3 className="font-semibold text-sm mb-2">Let hierop</h3>
                  <ul className="space-y-1.5">
                    {g.cues.map((c, i) => (
                      <li key={i} className="text-sm text-gray-700 pl-4 relative before:content-['›'] before:absolute before:left-0 before:text-brand-500 before:font-bold">
                        {c}
                      </li>
                    ))}
                  </ul>
                </section>

                <section>
                  <h3 className="font-semibold text-sm mb-2">Veelgemaakte fouten</h3>
                  <ul className="space-y-1.5">
                    {g.mistakes.map((c, i) => (
                      <li key={i} className="text-sm text-gray-700 pl-4 relative before:content-['×'] before:absolute before:left-0 before:text-red-500 before:font-bold">
                        {c}
                      </li>
                    ))}
                  </ul>
                </section>

                {g.tip && (
                  <div className="rounded-lg bg-amber-50 px-3 py-2.5 text-sm text-amber-800">
                    <span className="font-semibold">Tip: </span>
                    {g.tip}
                  </div>
                )}
                {guide?.source === "ai" && <p className="text-[11px] text-gray-400">Uitleg gegenereerd door de coach-AI; check bij twijfel de video.</p>}
              </>
            )}
            {guide && (
              <a
                href={guide.videoUrl}
                target="_blank"
                rel="noreferrer"
                className="block text-center rounded-lg border border-gray-200 bg-surface py-2.5 text-sm font-medium text-gray-800"
              >
                Bekijk video&apos;s op YouTube
              </a>
            )}
          </div>
        )}

        {tab === "voortgang" && (
          <div>
            {!progress ? (
              <Spinner />
            ) : progress.sessions.length === 0 ? (
              <p className="text-sm text-gray-500">Nog geen sets gelogd voor deze oefening. Na je eerste training zie je hier je lijn omhoog gaan.</p>
            ) : (
              <div className="space-y-4">
                <div className="grid grid-cols-3 gap-2 text-center">
                  {[
                    { v: `${progress.sessions[progress.sessions.length - 1].topWeight} kg`, l: "laatste topset" },
                    { v: `${Math.max(...progress.sessions.map((s) => s.e1rm))}`, l: "beste geschat 1RM" },
                    { v: String(progress.prCount), l: "records" },
                  ].map((x) => (
                    <div key={x.l} className="rounded-lg bg-surface border border-gray-100 py-2.5">
                      <p className="font-display font-bold text-lg leading-none">{x.v}</p>
                      <p className="text-[10px] text-gray-500 mt-1">{x.l}</p>
                    </div>
                  ))}
                </div>
                {progress.sessions.length >= 2 ? (
                  <div className="rounded-lg bg-surface border border-gray-100 p-3">
                    <p className="text-xs text-gray-500 mb-1">Geschat 1RM per training (kg)</p>
                    <ResponsiveContainer width="100%" height={160}>
                      <LineChart data={progress.sessions.map((s) => ({ ...s, label: s.date.slice(5).replace("-", "/") }))}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#E2DED5" />
                        <XAxis dataKey="label" fontSize={10} tick={{ fill: "#7C776C" }} />
                        <YAxis fontSize={10} width={32} domain={["dataMin - 5", "dataMax + 5"]} tick={{ fill: "#7C776C" }} />
                        <Tooltip contentStyle={{ background: "#FFFFFF", border: "1px solid #E2DED5", color: "#161512", borderRadius: 8 }} />
                        <Line type="monotone" dataKey="e1rm" stroke="#E5481A" strokeWidth={2} dot={{ r: 3, fill: "#E5481A" }} isAnimationActive={false} />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                ) : (
                  <p className="text-sm text-gray-500">Na je tweede training verschijnt hier je grafiek.</p>
                )}
                <div className="space-y-1">
                  {[...progress.sessions].reverse().slice(0, 6).map((s) => (
                    <div key={s.date} className="flex justify-between text-sm text-gray-700 border-b border-gray-100 py-1.5 last:border-0">
                      <span className="text-gray-500">{s.date.slice(5).replace("-", "/")}</span>
                      <span>
                        {s.topReps} × {s.topWeight} kg <span className="text-gray-400">· {s.sets} sets</span>
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
