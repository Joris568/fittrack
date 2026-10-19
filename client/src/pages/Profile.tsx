import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../api/client.js";
import { ProfileResponse, UserProfile } from "../api/types.js";
import { Button, Card, Input, PageTitle, Spinner } from "../components/ui.js";

const EMPTY: UserProfile = { heightCm: null, birthYear: null, sex: null, activity: null, goal: null, experience: null, trainDays: null, injuries: null };

const ACTIVITY: { v: NonNullable<UserProfile["activity"]>; l: string }[] = [
  { v: "sedentary", l: "Zittend (kantoor, weinig bewegen)" },
  { v: "light", l: "Licht actief" },
  { v: "moderate", l: "Matig actief" },
  { v: "active", l: "Zeer actief" },
  { v: "very_active", l: "Fysiek zwaar werk" },
];

function Chips<T extends string | number>({
  value,
  options,
  onChange,
}: {
  value: T | null;
  options: { v: T; l: string }[];
  onChange: (v: T) => void;
}) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {options.map((o) => (
        <button
          key={String(o.v)}
          type="button"
          onClick={() => onChange(o.v)}
          className={`px-3 py-2 rounded-lg text-sm border ${
            value === o.v ? "bg-gray-900 text-white border-gray-900" : "bg-surface text-gray-700 border-gray-200"
          }`}
        >
          {o.l}
        </button>
      ))}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="text-xs font-medium text-gray-500 mb-1.5">{label}</p>
      {children}
    </div>
  );
}

export default function Profile() {
  const [data, setData] = useState<ProfileResponse | null>(null);
  const [form, setForm] = useState<UserProfile>(EMPTY);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [goalSet, setGoalSet] = useState(false);

  function apply(res: ProfileResponse) {
    setData(res);
    setForm({ ...EMPTY, ...(res.profile ?? {}) });
  }

  useEffect(() => {
    api.get<ProfileResponse>("/profile").then(apply);
  }, []);

  async function save() {
    setSaving(true);
    setMessage(null);
    try {
      const { heightCm, birthYear, sex, activity, goal, experience, trainDays, injuries, priorityMuscles } = form;
      apply(await api.put<ProfileResponse>("/profile", { heightCm, birthYear, sex, activity, goal, experience, trainDays, injuries: injuries || null, priorityMuscles: priorityMuscles ?? [] }));
      setMessage("Opgeslagen");
    } catch {
      setMessage("Opslaan mislukt. Controleer lengte (120-230) en geboortejaar.");
    } finally {
      setSaving(false);
    }
  }

  async function removeNote(note: string) {
    if (!data) return;
    apply(await api.put<ProfileResponse>("/profile", { coachNotes: data.notes.filter((n) => n !== note) }));
  }

  async function useSuggestion() {
    const s = data?.insights.suggestion;
    if (!s) return;
    await api.post("/goals", { calories: s.calories, proteinGrams: s.proteinGrams, carbsGrams: s.carbsGrams, fatGrams: s.fatGrams });
    setGoalSet(true);
  }

  if (!data) return <Spinner />;
  const { insights: i } = data;

  return (
    <div className="space-y-4">
      <PageTitle>Mijn profiel</PageTitle>
      <p className="text-sm text-gray-500 -mt-2">
        Hiermee rekent de app je onderhoud en macro&apos;s uit, en weet de coach waar hij het over heeft.
      </p>

      <Card className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <Field label="Lengte (cm)">
            <Input type="number" inputMode="numeric" value={form.heightCm ?? ""} onChange={(e) => setForm((f) => ({ ...f, heightCm: e.target.value ? Number(e.target.value) : null }))} />
          </Field>
          <Field label="Geboortejaar">
            <Input type="number" inputMode="numeric" placeholder="bv. 1999" value={form.birthYear ?? ""} onChange={(e) => setForm((f) => ({ ...f, birthYear: e.target.value ? Number(e.target.value) : null }))} />
          </Field>
        </div>
        <Field label="Geslacht">
          <Chips value={form.sex} options={[{ v: "male", l: "Man" }, { v: "female", l: "Vrouw" }]} onChange={(v) => setForm((f) => ({ ...f, sex: v }))} />
        </Field>
        <Field label="Je doel">
          <Chips
            value={form.goal}
            options={[{ v: "bulk", l: "Opbouwen (bulk)" }, { v: "maintain", l: "Onderhouden" }, { v: "cut", l: "Afvallen (cut)" }]}
            onChange={(v) => setForm((f) => ({ ...f, goal: v }))}
          />
        </Field>
        <Field label="Ervaring met trainen">
          <Chips
            value={form.experience}
            options={[{ v: "beginner", l: "Beginner (<1 jr)" }, { v: "intermediate", l: "Gemiddeld (1-3 jr)" }, { v: "advanced", l: "Gevorderd (3+ jr)" }]}
            onChange={(v) => setForm((f) => ({ ...f, experience: v }))}
          />
        </Field>
        <Field label="Trainingsdagen per week">
          <Chips value={form.trainDays} options={[1, 2, 3, 4, 5, 6, 7].map((n) => ({ v: n, l: String(n) }))} onChange={(v) => setForm((f) => ({ ...f, trainDays: v }))} />
        </Field>
        <Field label="Dagelijkse activiteit (zonder training)">
          <Chips value={form.activity} options={ACTIVITY} onChange={(v) => setForm((f) => ({ ...f, activity: v }))} />
        </Field>
        <Field label="Waar wil je extra op focussen? (lichaamskaart en volume)">
          <div className="flex flex-wrap gap-1.5">
            {["Schouders", "Rug", "Borst", "Armen", "Benen", "Core"].map((g) => {
              const on = (form.priorityMuscles ?? []).includes(g);
              return (
                <button
                  key={g}
                  type="button"
                  onClick={() =>
                    setForm((f) => ({
                      ...f,
                      priorityMuscles: on ? (f.priorityMuscles ?? []).filter((x) => x !== g) : [...(f.priorityMuscles ?? []), g],
                    }))
                  }
                  className={`px-3 py-2 rounded-lg text-sm border ${on ? "bg-gray-900 text-white border-gray-900" : "bg-surface text-gray-700 border-gray-200"}`}
                >
                  {g}
                </button>
              );
            })}
          </div>
          <p className="text-[11px] text-gray-400 mt-1">Voor een brede V-taper kies je Schouders en Rug.</p>
        </Field>
        <Field label="Blessures of beperkingen">
          <Input placeholder="bv. rechterschouder, lage rug" value={form.injuries ?? ""} onChange={(e) => setForm((f) => ({ ...f, injuries: e.target.value }))} />
        </Field>
        <Button className="w-full" onClick={save} disabled={saving}>
          {saving ? "Bezig..." : "Opslaan"}
        </Button>
        {message && <p className={`text-sm text-center ${message === "Opgeslagen" ? "text-brand-600" : "text-red-500"}`}>{message}</p>}
      </Card>

      <Card>
        <h2 className="font-display font-bold text-lg mb-3">Je calorieën</h2>
        {i.formula || i.measured ? (
          <div className="space-y-2 text-sm">
            {i.formula && (
              <div className="flex justify-between">
                <span className="text-gray-600">Berekend onderhoud (formule)</span>
                <span className="font-semibold">{i.formula} kcal</span>
              </div>
            )}
            {i.measured ? (
              <div className="flex justify-between">
                <span className="text-gray-600">Gemeten onderhoud (4 weken)</span>
                <span className="font-semibold">{i.measured.tdee} kcal</span>
              </div>
            ) : (
              <p className="text-xs text-gray-500">
                Het gemeten onderhoud verschijnt zodra je ongeveer 2 weken je eten logt (minstens 10 dagen) en je jezelf minstens 4 keer weegt. Dat is nauwkeuriger dan een formule.
              </p>
            )}
            {i.measured && (
              <p className="text-xs text-gray-500">
                Gebaseerd op {i.measured.loggedDays} gelogde dagen en {i.measured.weighIns} wegingen; gewicht {i.measured.kgPerWeek >= 0 ? "+" : ""}
                {i.measured.kgPerWeek} kg/week.
              </p>
            )}
          </div>
        ) : (
          <p className="text-sm text-gray-500">
            Vul lengte, geboortejaar, geslacht en activiteit in en log je gewicht ({i.latestWeightKg ? "gelukt" : "nog niet gedaan"}), dan reken ik je onderhoud uit.
          </p>
        )}
        {i.suggestion && (
          <div className="mt-4 rounded-lg bg-gray-50 p-3">
            <p className="text-xs text-gray-500 mb-1">Voorgesteld doel ({i.suggestion.goal === "bulk" ? "opbouwen" : i.suggestion.goal === "cut" ? "afvallen" : "onderhouden"}, op basis van {i.suggestion.basedOn})</p>
            <p className="font-display font-bold text-xl">{i.suggestion.calories} kcal</p>
            <p className="text-sm text-gray-600">
              {i.suggestion.proteinGrams} g eiwit · {i.suggestion.carbsGrams} g koolhydraten · {i.suggestion.fatGrams} g vet
            </p>
            <Button className="w-full mt-3" onClick={useSuggestion} disabled={goalSet}>
              {goalSet ? "Ingesteld als voedingsdoel" : "Gebruik als voedingsdoel"}
            </Button>
          </div>
        )}
      </Card>

      <Card>
        <h2 className="font-display font-bold text-lg mb-1">Wat de coach onthoudt</h2>
        <p className="text-xs text-gray-500 mb-3">
          Vertel de coach iets blijvends (een blessure, je materiaal, een deadline) en hij slaat het hier op. Je kunt het ook zelf verwijderen.
        </p>
        {data.notes.length === 0 ? (
          <p className="text-sm text-gray-400">Nog niets onthouden.</p>
        ) : (
          <ul className="space-y-1.5">
            {data.notes.map((n) => (
              <li key={n} className="flex items-start justify-between gap-2 text-sm rounded-lg bg-gray-50 px-3 py-2">
                <span>{n}</span>
                <button className="text-gray-400 shrink-0" onClick={() => removeNote(n)} aria-label="Vergeet dit">
                  ✕
                </button>
              </li>
            ))}
          </ul>
        )}
        <Link to="/coach" className="block mt-3 text-sm text-brand-600 font-medium">
          Praat met de coach
        </Link>
      </Card>
    </div>
  );
}
