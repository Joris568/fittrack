import { useState } from "react";
import { Button } from "../ui.js";

export interface Readiness {
  sleep: number;
  soreness: number;
  energy: number;
  score: number;
}

const ROWS: { key: "sleep" | "soreness" | "energy"; label: string; options: [string, string, string] }[] = [
  { key: "sleep", label: "Slaap", options: ["Slecht", "Oké", "Goed"] },
  { key: "soreness", label: "Spierpijn", options: ["Veel", "Wat", "Geen"] },
  { key: "energy", label: "Energie", options: ["Laag", "Oké", "Hoog"] },
];

export function readinessAdvice(score: number): { level: "laag" | "normaal" | "goed"; text: string } {
  if (score <= 4) return { level: "laag", text: "Rustige dag: doe 1 set minder per oefening en stop op RPE 8. Een gemiste prikkel is minder erg dan een uitgeputte week." };
  if (score >= 8) return { level: "goed", text: "Goede dag. Dit is een kans om je suggestie te halen of een record te pakken." };
  return { level: "normaal", text: "Normale dag. Train zoals gepland." };
}

/** Thirty-second check before the first set: sleep, soreness, energy. A low score offers to trim the day. */
export default function ReadinessCard({
  saved,
  onSave,
  onTrim,
}: {
  saved: Readiness | null;
  onSave: (r: Readiness) => void;
  onTrim: () => void;
}) {
  const [values, setValues] = useState<Record<"sleep" | "soreness" | "energy", number>>({ sleep: 0, soreness: 0, energy: 0 });
  const [trimmed, setTrimmed] = useState(false);

  if (saved) {
    const a = readinessAdvice(saved.score);
    return (
      <div className={`rounded-xl border px-4 py-3 ${a.level === "laag" ? "border-amber-200 bg-amber-50" : "border-gray-100 bg-surface"}`}>
        <p className="text-xs font-semibold text-gray-600">
          Readiness {saved.score}/9 · {a.level}
        </p>
        <p className="text-sm text-gray-700 mt-0.5">{a.text}</p>
        {a.level === "laag" && !trimmed && (
          <Button
            variant="secondary"
            className="mt-2 !py-1.5 text-xs"
            onClick={() => {
              onTrim();
              setTrimmed(true);
            }}
          >
            Pas schema aan (1 set minder)
          </Button>
        )}
        {trimmed && <p className="text-xs text-brand-600 font-medium mt-1.5">Schema aangepast voor vandaag.</p>}
      </div>
    );
  }

  const complete = ROWS.every((r) => values[r.key] > 0);
  return (
    <div className="rounded-xl border border-gray-100 bg-surface p-4 shadow-card space-y-3">
      <div>
        <p className="font-semibold text-sm">Hoe voel je je vandaag?</p>
        <p className="text-xs text-gray-500">Drie tikken. De app past je dag aan als je moe bent.</p>
      </div>
      {ROWS.map((r) => (
        <div key={r.key}>
          <p className="text-[11px] font-medium text-gray-500 mb-1">{r.label}</p>
          <div className="grid grid-cols-3 gap-1.5">
            {r.options.map((label, i) => (
              <button
                key={label}
                type="button"
                onClick={() => setValues((v) => ({ ...v, [r.key]: i + 1 }))}
                className={`py-2 rounded-lg text-sm font-semibold border ${values[r.key] === i + 1 ? "bg-gray-900 text-white border-gray-900" : "bg-bg-raised text-gray-600 border-gray-200"}`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      ))}
      <Button
        className="w-full"
        disabled={!complete}
        onClick={() => onSave({ ...values, score: values.sleep + values.soreness + values.energy })}
      >
        Klaar
      </Button>
    </div>
  );
}
