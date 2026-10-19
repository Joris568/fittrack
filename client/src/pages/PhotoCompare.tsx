import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../api/client.js";
import { ProgressPhoto } from "../api/types.js";
import { Card, PageTitle, Spinner } from "../components/ui.js";

const fmt = (iso: string) => new Date(iso).toLocaleDateString("nl-NL", { day: "numeric", month: "short", year: "numeric" });

/** Before/after of two progress photos with a slider, to see changes the scale never shows. */
export default function PhotoCompare() {
  const [photos, setPhotos] = useState<ProgressPhoto[] | null>(null);
  const [beforeId, setBeforeId] = useState<string | null>(null);
  const [afterId, setAfterId] = useState<string | null>(null);
  const [split, setSplit] = useState(50);

  useEffect(() => {
    api.get<ProgressPhoto[]>("/progress-photos").then((list) => {
      const sorted = [...list].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
      setPhotos(sorted);
      if (sorted.length >= 2) {
        setBeforeId(sorted[0].id);
        setAfterId(sorted[sorted.length - 1].id);
      }
    });
  }, []);

  if (!photos) return <Spinner />;
  const before = photos.find((p) => p.id === beforeId);
  const after = photos.find((p) => p.id === afterId);

  if (photos.length < 2) {
    return (
      <div className="space-y-4">
        <PageTitle>Foto&apos;s vergelijken</PageTitle>
        <Card>
          <p className="text-sm text-gray-600">Je hebt minstens twee voortgangsfoto&apos;s nodig om te vergelijken. Maak er elke maand één, op dezelfde plek en met hetzelfde licht.</p>
          <Link to="/coach" className="block mt-3 text-sm text-brand-600 font-medium">
            Foto toevoegen via de coach
          </Link>
        </Card>
      </div>
    );
  }

  const days = before && after ? Math.round((new Date(after.date).getTime() - new Date(before.date).getTime()) / 86_400_000) : 0;

  const Picker = ({ label, value, onPick }: { label: string; value: string | null; onPick: (id: string) => void }) => (
    <div>
      <p className="text-xs font-medium text-gray-500 mb-1.5">{label}</p>
      <div className="flex gap-1.5 overflow-x-auto pb-1">
        {photos.map((p) => (
          <button key={p.id} type="button" onClick={() => onPick(p.id)} className="shrink-0 text-left">
            <img src={p.imageData} alt={fmt(p.date)} className={`w-14 h-[74px] object-cover rounded-lg border-2 ${value === p.id ? "border-gray-900" : "border-transparent opacity-70"}`} />
            <span className="block text-[10px] text-gray-500 mt-0.5">{new Date(p.date).toLocaleDateString("nl-NL", { day: "numeric", month: "short" })}</span>
          </button>
        ))}
      </div>
    </div>
  );

  return (
    <div className="space-y-4">
      <PageTitle>Foto&apos;s vergelijken</PageTitle>
      {before && after && (
        <div>
          <div className="relative w-full aspect-[3/4] overflow-hidden rounded-xl bg-gray-100 select-none">
            <img src={after.imageData} alt="Nu" className="absolute inset-0 w-full h-full object-cover" />
            <div className="absolute inset-0" style={{ clipPath: `inset(0 ${100 - split}% 0 0)` }}>
              <img src={before.imageData} alt="Voor" className="w-full h-full object-cover" />
            </div>
            <div className="absolute top-0 bottom-0 w-0.5 bg-white shadow" style={{ left: `${split}%` }} />
            <span className="absolute top-2 left-2 text-[11px] font-semibold bg-gray-900/70 text-white rounded px-2 py-0.5">{fmt(before.date)}</span>
            <span className="absolute top-2 right-2 text-[11px] font-semibold bg-gray-900/70 text-white rounded px-2 py-0.5">{fmt(after.date)}</span>
          </div>
          <input
            type="range"
            min={0}
            max={100}
            value={split}
            onChange={(e) => setSplit(Number(e.target.value))}
            className="w-full mt-3 accent-[#E5481A]"
            aria-label="Schuif tussen voor en na"
          />
          <p className="text-xs text-gray-500 text-center">{days > 0 ? `${days} dagen tussen deze foto's` : "Kies twee verschillende foto's"}</p>
        </div>
      )}
      <Card className="space-y-3">
        <Picker label="Voor" value={beforeId} onPick={setBeforeId} />
        <Picker label="Nu" value={afterId} onPick={setAfterId} />
      </Card>
    </div>
  );
}
