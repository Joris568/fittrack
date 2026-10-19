/** Front and back silhouette coloured by how many hard sets each muscle group got in the last
 * 7 days, compared with its target (higher for the groups the user wants to emphasise). */
export interface MuscleVolume {
  group: string;
  sets: number;
}

const BASE = "#EFECE5";
const SHADES = ["#FFC2A6", "#FF9A6E", "#E5481A"];

export function targetFor(group: string, priorities: string[]): number {
  return priorities.includes(group) ? 12 : 8;
}

function shade(sets: number, target: number): string {
  if (sets <= 0) return BASE;
  const ratio = sets / target;
  return ratio >= 1 ? SHADES[2] : ratio >= 0.5 ? SHADES[1] : SHADES[0];
}

export default function BodyMap({ volume, priorities }: { volume: MuscleVolume[]; priorities: string[] }) {
  const sets = new Map(volume.map((v) => [v.group, v.sets]));
  const fill = (g: string) => shade(sets.get(g) ?? 0, targetFor(g, priorities));
  const stroke = (g: string) => (priorities.includes(g) ? { stroke: "#161512", strokeWidth: 1.6 } : { stroke: "#DAD5CA", strokeWidth: 1 });
  const part = (g: string) => ({ fill: fill(g), ...stroke(g) });

  const Silhouette = ({ x, back }: { x: number; back?: boolean }) => (
    <g transform={`translate(${x},0)`}>
      {/* continuous silhouette behind the muscle groups */}
      <g stroke="#E9E5DA" strokeLinecap="round" fill="none">
        <line x1="60" y1="48" x2="60" y2="108" strokeWidth="52" />
        <line x1="47" y1="116" x2="73" y2="116" strokeWidth="34" />
        <line x1="22" y1="52" x2="16" y2="122" strokeWidth="24" />
        <line x1="98" y1="52" x2="104" y2="122" strokeWidth="24" />
        <line x1="47" y1="126" x2="46" y2="228" strokeWidth="30" />
        <line x1="73" y1="126" x2="74" y2="228" strokeWidth="30" />
        <line x1="60" y1="28" x2="60" y2="40" strokeWidth="12" />
      </g>
      <circle cx="60" cy="16" r="12" fill="#E2DDD1" />
      {/* shoulders */}
      <circle cx="30" cy="46" r="11" {...part("Schouders")} />
      <circle cx="90" cy="46" r="11" {...part("Schouders")} />
      {back ? (
        <>
          <path d="M38 40 Q60 34 82 40 L80 78 Q76 100 60 108 Q44 100 40 78 Z" {...part("Rug")} />
          <rect x="44" y="92" width="32" height="20" rx="9" {...part("Rug")} />
          {/* triceps + forearms */}
          <rect x="13" y="58" width="15" height="32" rx="7" {...part("Armen")} />
          <rect x="92" y="58" width="15" height="32" rx="7" {...part("Armen")} />
          <rect x="9" y="94" width="13" height="34" rx="6" {...part("Armen")} />
          <rect x="98" y="94" width="13" height="34" rx="6" {...part("Armen")} />
          {/* glutes + hamstrings + calves */}
          <rect x="36" y="114" width="48" height="24" rx="12" {...part("Benen")} />
          <rect x="36" y="142" width="22" height="46" rx="11" {...part("Benen")} />
          <rect x="62" y="142" width="22" height="46" rx="11" {...part("Benen")} />
          <rect x="38" y="192" width="17" height="46" rx="8" {...part("Benen")} />
          <rect x="65" y="192" width="17" height="46" rx="8" {...part("Benen")} />
        </>
      ) : (
        <>
          <rect x="34" y="46" width="25" height="24" rx="9" {...part("Borst")} />
          <rect x="61" y="46" width="25" height="24" rx="9" {...part("Borst")} />
          <rect x="42" y="73" width="36" height="42" rx="11" {...part("Core")} />
          <rect x="13" y="58" width="15" height="32" rx="7" {...part("Armen")} />
          <rect x="92" y="58" width="15" height="32" rx="7" {...part("Armen")} />
          <rect x="9" y="94" width="13" height="34" rx="6" {...part("Armen")} />
          <rect x="98" y="94" width="13" height="34" rx="6" {...part("Armen")} />
          <rect x="36" y="120" width="22" height="62" rx="11" {...part("Benen")} />
          <rect x="62" y="120" width="22" height="62" rx="11" {...part("Benen")} />
          <rect x="38" y="188" width="17" height="50" rx="8" {...part("Benen")} />
          <rect x="65" y="188" width="17" height="50" rx="8" {...part("Benen")} />
        </>
      )}
    </g>
  );

  return (
    <div>
      <svg viewBox="0 0 260 258" className="w-full max-w-[330px] mx-auto" role="img" aria-label="Lichaamskaart: sets per spiergroep de laatste 7 dagen">
        <Silhouette x={0} />
        <Silhouette x={140} back />
        <text x="60" y="254" textAnchor="middle" fontSize="9" fill="#8F8A7F">voorkant</text>
        <text x="200" y="254" textAnchor="middle" fontSize="9" fill="#8F8A7F">achterkant</text>
      </svg>
      <div className="flex justify-center gap-3 text-[11px] text-gray-500 mt-1">
        <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-sm" style={{ background: SHADES[0] }} /> weinig</span>
        <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-sm" style={{ background: SHADES[1] }} /> op weg</span>
        <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-sm" style={{ background: SHADES[2] }} /> doel gehaald</span>
        {priorities.length > 0 && <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-sm border-2 border-gray-900" /> focus</span>}
      </div>
    </div>
  );
}
