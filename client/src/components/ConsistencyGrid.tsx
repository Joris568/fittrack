import { useEffect, useState } from "react";
import { api } from "../api/client.js";

const LEVELS = ["#EFECE5", "#FFC2A6", "#FF9A6E", "#E5481A"];

function level(sets: number): number {
  if (sets <= 0) return 0;
  if (sets <= 10) return 1;
  if (sets <= 20) return 2;
  return 3;
}

function addDays(key: string, n: number): string {
  const d = new Date(`${key}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

/** GitHub-style grid of the last half year: one square per day, darker for harder sessions. */
export default function ConsistencyGrid({ weeks = 26 }: { weeks?: number }) {
  const [data, setData] = useState<{ from: string; to: string; days: Record<string, number> } | null>(null);

  useEffect(() => {
    api.get<{ from: string; to: string; days: Record<string, number> }>(`/calendar/heatmap?weeks=${weeks}`).then(setData).catch(() => {});
  }, [weeks]);

  if (!data) return null;
  const columns = Array.from({ length: weeks }, (_, w) => Array.from({ length: 7 }, (_, d) => addDays(data.from, w * 7 + d)));
  const trained = Object.keys(data.days).length;
  const monthFor = (key: string) => new Date(`${key}T00:00:00Z`).toLocaleDateString("nl-NL", { month: "short", timeZone: "UTC" });
  // one label per month change, never two closer than 3 columns (they would overlap)
  const labelAt = new Map<number, string>();
  let lastLabel = -10;
  columns.forEach((col, w) => {
    const changed = w === 0 || monthFor(col[0]) !== monthFor(columns[w - 1][0]);
    const lasts = w === 0 ? monthFor(columns[Math.min(3, columns.length - 1)][0]) === monthFor(col[0]) : true;
    if (changed && lasts && w - lastLabel >= 3) {
      labelAt.set(w, monthFor(col[0]));
      lastLabel = w;
    }
  });

  return (
    <div>
      <div className="flex gap-[3px]">
        {columns.map((col, w) => (
          <div key={w} className="flex-1 min-w-0">
            <div className="h-3 text-[9px] text-gray-400 leading-3 overflow-visible whitespace-nowrap">
              {labelAt.get(w) ?? ""}
            </div>
            <div className="flex flex-col gap-[3px]">
              {col.map((key) => (
                <div
                  key={key}
                  title={key}
                  className="w-full aspect-square rounded-[3px]"
                  style={{ background: key > data.to ? "transparent" : LEVELS[level(data.days[key] ?? 0)] }}
                />
              ))}
            </div>
          </div>
        ))}
      </div>
      <div className="flex items-center justify-between mt-2 text-[11px] text-gray-500">
        <span>
          {trained} trainingsdagen in {weeks} weken
        </span>
        <span className="flex items-center gap-1">
          minder
          {LEVELS.map((c) => (
            <span key={c} className="w-2.5 h-2.5 rounded-[3px]" style={{ background: c }} />
          ))}
          meer
        </span>
      </div>
    </div>
  );
}
