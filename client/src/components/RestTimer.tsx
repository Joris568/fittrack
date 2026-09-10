import { useEffect, useRef, useState } from "react";

function beep() {
  try {
    const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.frequency.value = 880;
    gain.gain.setValueAtTime(0.15, ctx.currentTime);
    osc.start();
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.4);
    osc.stop(ctx.currentTime + 0.4);
  } catch {
    // Web Audio unsupported/blocked — silently skip the beep.
  }
  if (navigator.vibrate) navigator.vibrate([200, 100, 200]);
}

/** A countdown that (re)starts whenever `startKey` changes — pass a new value
 * (e.g. a set's id) each time a rest period should begin. */
export default function RestTimer({
  seconds,
  startKey,
  onDone,
}: {
  seconds: number;
  startKey: string | number;
  onDone?: () => void;
}) {
  const [remaining, setRemaining] = useState(seconds);
  const [running, setRunning] = useState(true);
  const doneFired = useRef(false);

  useEffect(() => {
    setRemaining(seconds);
    setRunning(true);
    doneFired.current = false;
  }, [startKey, seconds]);

  useEffect(() => {
    if (!running) return;
    if (remaining <= 0) {
      if (!doneFired.current) {
        doneFired.current = true;
        beep();
        onDone?.();
      }
      return;
    }
    const t = setTimeout(() => setRemaining((r) => r - 1), 1000);
    return () => clearTimeout(t);
  }, [remaining, running, onDone]);

  if (remaining <= 0 && !running) return null;

  const mm = Math.floor(Math.max(0, remaining) / 60);
  const ss = Math.max(0, remaining) % 60;

  return (
    <div className="flex items-center gap-2 bg-brand-50 rounded-xl px-3 py-2 text-sm">
      <span className="font-mono font-semibold text-brand-700">
        {mm}:{ss.toString().padStart(2, "0")}
      </span>
      <span className="text-xs text-gray-500">rust</span>
      <div className="flex-1" />
      <button
        className="text-xs text-brand-600 font-medium"
        onClick={() => setRemaining((r) => r + 30)}
        type="button"
      >
        +30s
      </button>
      <button
        className="text-xs text-gray-400"
        onClick={() => {
          setRunning(false);
          setRemaining(0);
        }}
        type="button"
      >
        overslaan
      </button>
    </div>
  );
}
