import { useEffect, useState } from "react";

interface WakeLockSentinelLike {
  release: () => Promise<void>;
  addEventListener: (type: "release", cb: () => void) => void;
}

/** Keeps the screen on while `enabled` (a workout in progress), and takes the lock again when the
 * app comes back to the foreground — the browser drops it whenever the page is hidden.
 * Returns whether the lock is currently held (false where the browser doesn't support it). */
export function useWakeLock(enabled: boolean): boolean {
  const [held, setHeld] = useState(false);

  useEffect(() => {
    const wakeLock = (navigator as unknown as { wakeLock?: { request: (t: "screen") => Promise<WakeLockSentinelLike> } }).wakeLock;
    if (!enabled || !wakeLock) {
      setHeld(false);
      return;
    }
    let sentinel: WakeLockSentinelLike | null = null;
    let cancelled = false;

    const acquire = async () => {
      if (cancelled || document.visibilityState !== "visible") return;
      try {
        sentinel = await wakeLock.request("screen");
        if (cancelled) {
          sentinel.release().catch(() => {});
          return;
        }
        setHeld(true);
        sentinel.addEventListener("release", () => setHeld(false));
      } catch {
        setHeld(false); // denied (battery saver etc.) — the workout works fine without it
      }
    };

    const onVisible = () => {
      if (document.visibilityState === "visible") acquire();
    };
    acquire();
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      cancelled = true;
      document.removeEventListener("visibilitychange", onVisible);
      sentinel?.release().catch(() => {});
      setHeld(false);
    };
  }, [enabled]);

  return held;
}
