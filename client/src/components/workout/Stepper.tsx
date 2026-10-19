import { useRef } from "react";

/** Number field with big −/+ buttons, so sets can be logged with one thumb between sets. */
export default function Stepper({
  label,
  value,
  step,
  min = 0,
  max = 999,
  decimals = false,
  onChange,
}: {
  label: string;
  value: string;
  step: number;
  min?: number;
  max?: number;
  decimals?: boolean;
  onChange: (v: string) => void;
}) {
  // Quick successive taps must build on each other even before React has re-rendered.
  const latest = useRef(value);
  latest.current = value;
  const bump = (dir: 1 | -1) => {
    const cur = Number(latest.current);
    const base = Number.isFinite(cur) && latest.current !== "" ? cur : 0;
    const next = Math.min(max, Math.max(min, Math.round((base + dir * step) * 100) / 100));
    latest.current = String(next);
    onChange(String(next));
  };
  return (
    <div className="flex-1 min-w-0">
      <p className="text-[11px] font-medium text-gray-500 mb-1 text-center">{label}</p>
      <div className="flex items-stretch rounded-lg border border-gray-200 bg-bg-raised overflow-hidden">
        <button
          type="button"
          onClick={() => bump(-1)}
          className="w-11 shrink-0 text-xl text-gray-600 active:bg-gray-100"
          aria-label={`${label} omlaag`}
        >
          −
        </button>
        <input
          type="number"
          inputMode={decimals ? "decimal" : "numeric"}
          step={decimals ? "0.1" : "1"}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="w-full min-w-0 text-center font-display font-bold text-xl bg-transparent py-2.5 focus:outline-none"
          aria-label={label}
        />
        <button
          type="button"
          onClick={() => bump(1)}
          className="w-11 shrink-0 text-xl text-gray-600 active:bg-gray-100"
          aria-label={`${label} omhoog`}
        >
          +
        </button>
      </div>
    </div>
  );
}
