/** Small dependency-free SVG visuals for the dashboard. */

export function Ring({
  value,
  goal,
  label,
  unit,
  size = 76,
}: {
  value: number;
  goal: number;
  label: string;
  unit: string;
  size?: number;
}) {
  const stroke = 7;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const pct = goal > 0 ? Math.min(1, value / goal) : 0;
  const over = goal > 0 && value > goal * 1.05;
  const left = Math.round(goal - value);
  return (
    <div className="flex flex-col items-center text-center">
      <p className="text-xs text-gray-500 mb-1.5">{label}</p>
      <div className="relative" style={{ width: size, height: size }}>
        <svg width={size} height={size} className="-rotate-90">
          <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#EFECE5" strokeWidth={stroke} />
          <circle
            cx={size / 2}
            cy={size / 2}
            r={r}
            fill="none"
            stroke={over ? "#D93A2B" : "#E5481A"}
            strokeWidth={stroke}
            strokeLinecap="round"
            strokeDasharray={c}
            strokeDashoffset={c * (1 - pct)}
            style={{ transition: "stroke-dashoffset 0.6s ease" }}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center leading-tight">
          <span className="font-display font-bold text-sm">{value}</span>
          <span className="text-[10px] text-gray-400">/ {goal}</span>
        </div>
      </div>
      <p className={`text-[11px] mt-1.5 font-medium ${over ? "text-red-500" : "text-gray-600"}`}>
        {over ? `${-left}${unit} over` : `${left}${unit} te gaan`}
      </p>
    </div>
  );
}

export function Sparkline({ values, height = 36, color = "#E5481A" }: { values: number[]; height?: number; color?: string }) {
  if (values.length < 2) return <div style={{ height }} />;
  const w = 100;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;
  const pts = values.map((v, i) => `${(i / (values.length - 1)) * w},${height - 4 - ((v - min) / span) * (height - 8)}`);
  return (
    <svg viewBox={`0 0 ${w} ${height}`} preserveAspectRatio="none" className="w-full" style={{ height }}>
      <polyline points={pts.join(" ")} fill="none" stroke={color} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
    </svg>
  );
}

export function MiniBars({ values, height = 36 }: { values: number[]; height?: number }) {
  const max = Math.max(...values, 1);
  return (
    <div className="flex items-end gap-1" style={{ height }}>
      {values.map((v, i) => (
        <div
          key={i}
          className={`flex-1 rounded-sm ${v > 0 ? "bg-brand-500" : "bg-gray-100"}`}
          style={{ height: `${Math.max(8, (v / max) * 100)}%`, opacity: i === values.length - 1 ? 1 : 0.55 }}
        />
      ))}
    </div>
  );
}
