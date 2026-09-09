import { useEffect, useMemo, useState } from "react";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";
import { api } from "../api/client.js";
import { Exercise, SetLog, WorkoutSession } from "../api/types.js";
import { Card, Spinner, EmptyState, PageTitle } from "../components/ui.js";

function ProgressChart() {
  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [selected, setSelected] = useState<string>("");
  const [history, setHistory] = useState<SetLog[]>([]);

  useEffect(() => {
    api.get<Exercise[]>("/exercises").then(setExercises);
  }, []);

  useEffect(() => {
    if (!selected) return;
    api.get<SetLog[]>(`/workouts/exercise/${selected}/history`).then(setHistory);
  }, [selected]);

  const chartData = useMemo(() => {
    const byDate = new Map<string, number>();
    for (const s of [...history].reverse()) {
      const date = new Date(s.createdAt).toLocaleDateString("nl-NL", { day: "2-digit", month: "2-digit" });
      byDate.set(date, Math.max(byDate.get(date) ?? 0, s.weight));
    }
    return [...byDate.entries()].map(([date, weight]) => ({ date, weight }));
  }, [history]);

  return (
    <Card>
      <h2 className="font-semibold mb-2">Progressie</h2>
      <select
        className="w-full px-3 py-2 rounded-xl border border-gray-200 mb-3 text-sm"
        value={selected}
        onChange={(e) => setSelected(e.target.value)}
      >
        <option value="">Kies een oefening...</option>
        {exercises.map((ex) => (
          <option key={ex.id} value={ex.id}>
            {ex.name}
          </option>
        ))}
      </select>
      {selected && chartData.length > 0 ? (
        <ResponsiveContainer width="100%" height={200}>
          <LineChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" stroke="#eee" />
            <XAxis dataKey="date" fontSize={11} />
            <YAxis fontSize={11} width={30} />
            <Tooltip />
            <Line type="monotone" dataKey="weight" stroke="#16b862" strokeWidth={2} dot={{ r: 3 }} />
          </LineChart>
        </ResponsiveContainer>
      ) : selected ? (
        <p className="text-sm text-gray-400">Nog geen data voor deze oefening.</p>
      ) : null}
    </Card>
  );
}

export default function WorkoutHistory() {
  const [sessions, setSessions] = useState<WorkoutSession[] | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);

  async function load() {
    setSessions(await api.get<WorkoutSession[]>("/workouts?take=30"));
  }

  useEffect(() => {
    load();
  }, []);

  async function deleteSession(id: string) {
    if (!confirm("Deze training verwijderen?")) return;
    await api.delete(`/workouts/${id}`);
    load();
  }

  if (!sessions) return <Spinner />;

  return (
    <div className="space-y-4">
      <PageTitle>Geschiedenis</PageTitle>

      <ProgressChart />

      {sessions.length === 0 && <EmptyState>Nog geen trainingen gelogd.</EmptyState>}

      {sessions.map((session) => (
        <Card key={session.id}>
          <div
            className="flex justify-between items-center cursor-pointer"
            onClick={() => setExpanded(expanded === session.id ? null : session.id)}
          >
            <div>
              <p className="font-medium">{session.programDay?.name ?? "Vrije training"}</p>
              <p className="text-xs text-gray-400">
                {new Date(session.date).toLocaleDateString("nl-NL", {
                  weekday: "short",
                  day: "numeric",
                  month: "short",
                })}{" "}
                · {session.setLogs.length} sets
              </p>
            </div>
            <button
              className="text-xs text-red-500"
              onClick={(e) => {
                e.stopPropagation();
                deleteSession(session.id);
              }}
            >
              verwijderen
            </button>
          </div>
          {expanded === session.id && (
            <div className="mt-3 space-y-1 border-t border-gray-100 pt-2">
              {session.setLogs.map((s) => (
                <p key={s.id} className="text-sm text-gray-600">
                  {s.exercise.name}: {s.reps}x{s.weight}kg{s.rpe ? ` @RPE${s.rpe}` : ""}
                  {s.isPR && <span className="ml-1.5 text-amber-600 font-semibold">🏆 PR</span>}
                </p>
              ))}
            </div>
          )}
        </Card>
      ))}
    </div>
  );
}
