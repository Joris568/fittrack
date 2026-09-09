import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { api } from "../api/client.js";
import { WorkoutProgram, WorkoutSession } from "../api/types.js";
import { Card, Button, Input, Spinner, EmptyState, PageTitle } from "../components/ui.js";

export default function ProgramsList() {
  const [programs, setPrograms] = useState<WorkoutProgram[] | null>(null);
  const [newName, setNewName] = useState("");
  const [creating, setCreating] = useState(false);
  const navigate = useNavigate();

  async function load() {
    setPrograms(await api.get<WorkoutProgram[]>("/programs"));
  }

  useEffect(() => {
    load();
  }, []);

  async function createProgram(e: React.FormEvent) {
    e.preventDefault();
    if (!newName.trim()) return;
    const program = await api.post<WorkoutProgram>("/programs", { name: newName });
    setNewName("");
    setCreating(false);
    navigate(`/train/programs/${program.id}`);
  }

  async function startDay(dayId: string) {
    const session = await api.post<WorkoutSession>("/workouts", { programDayId: dayId });
    navigate(`/train/session/${session.id}`);
  }

  async function startFreestyle() {
    const session = await api.post<WorkoutSession>("/workouts", {});
    navigate(`/train/session/${session.id}`);
  }

  if (!programs) return <Spinner />;

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <PageTitle>Trainen</PageTitle>
        <Link to="/train/history" className="text-brand-600 text-sm font-medium">
          Geschiedenis
        </Link>
      </div>

      <Button variant="secondary" className="w-full" onClick={startFreestyle}>
        Vrije training starten
      </Button>

      {programs.length === 0 && !creating && (
        <EmptyState>Nog geen programma&apos;s. Bouw je eerste routine.</EmptyState>
      )}

      {programs.map((program) => (
        <Card key={program.id}>
          <div className="flex justify-between items-start mb-2">
            <div>
              <h2 className="font-semibold">{program.name}</h2>
              {program.description && <p className="text-xs text-gray-400">{program.description}</p>}
            </div>
            <Link to={`/train/programs/${program.id}`} className="text-sm text-brand-600 font-medium">
              Bewerken
            </Link>
          </div>
          {program.days.length === 0 ? (
            <p className="text-sm text-gray-400">Nog geen dagen toegevoegd.</p>
          ) : (
            <div className="space-y-2">
              {program.days.map((day) => (
                <div key={day.id} className="flex justify-between items-center bg-gray-50 rounded-xl px-3 py-2">
                  <div>
                    <p className="text-sm font-medium">{day.name}</p>
                    <p className="text-xs text-gray-400">{day.exercises.length} oefeningen</p>
                  </div>
                  <Button className="!px-3 !py-1.5 text-xs" onClick={() => startDay(day.id)}>
                    Start
                  </Button>
                </div>
              ))}
            </div>
          )}
        </Card>
      ))}

      {creating ? (
        <Card>
          <form onSubmit={createProgram} className="flex gap-2">
            <Input
              placeholder="Naam programma (bv. Push Pull Legs)"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              autoFocus
            />
            <Button type="submit">Aanmaken</Button>
          </form>
        </Card>
      ) : (
        <Button variant="secondary" className="w-full" onClick={() => setCreating(true)}>
          + Nieuw programma
        </Button>
      )}
    </div>
  );
}
