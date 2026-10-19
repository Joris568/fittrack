import { useEffect, useState } from "react";
import { api } from "../api/client.js";
import { Exercise } from "../api/types.js";
import { Input } from "./ui.js";

/** Search-and-pick sheet used to add an exercise to a training or swap one for another. */
export default function ExercisePicker({
  title,
  excludeIds,
  onPick,
  onClose,
}: {
  title: string;
  excludeIds: string[];
  onPick: (exercise: Exercise) => void;
  onClose: () => void;
}) {
  const [query, setQuery] = useState("");
  const [all, setAll] = useState<Exercise[]>([]);

  useEffect(() => {
    api.get<Exercise[]>("/exercises").then(setAll).catch(() => {});
  }, []);

  const q = query.trim().toLowerCase();
  const results = all
    .filter((e) => !excludeIds.includes(e.id) && (!q || e.name.toLowerCase().includes(q) || e.muscleGroup.toLowerCase().includes(q)))
    .slice(0, 40);

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center" role="dialog" aria-modal="true" aria-label={title}>
      <button className="absolute inset-0 bg-gray-900/50" onClick={onClose} aria-label="Sluiten" />
      <div className="relative w-full max-w-lg max-h-[82vh] flex flex-col bg-bg rounded-t-2xl sm:rounded-2xl px-4 pt-3 pb-6 animate-sheet">
        <div className="w-10 h-1 rounded-full bg-gray-300 mx-auto mb-3" />
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-display font-bold text-lg">{title}</h2>
          <button className="text-gray-400 text-lg leading-none px-1" onClick={onClose} aria-label="Sluiten">
            ✕
          </button>
        </div>
        <Input placeholder="Zoek op naam of spiergroep..." value={query} onChange={(e) => setQuery(e.target.value)} autoFocus />
        <div className="mt-2 overflow-y-auto -mx-1 px-1">
          {results.map((r) => (
            <button
              key={r.id}
              onClick={() => onPick(r)}
              className="w-full text-left px-3 py-2.5 rounded-lg hover:bg-gray-50 active:bg-gray-100 flex justify-between items-center"
            >
              <span className="text-sm font-medium">{r.name}</span>
              <span className="text-xs text-gray-400">{r.muscleGroup}</span>
            </button>
          ))}
          {results.length === 0 && <p className="text-sm text-gray-400 px-3 py-4">Niets gevonden.</p>}
        </div>
      </div>
    </div>
  );
}
