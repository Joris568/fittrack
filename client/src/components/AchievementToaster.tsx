import { useEffect, useState } from "react";
import { onAchievements } from "../lib/achievementBus.js";
import type { UnlockedAchievement } from "../api/types.js";

export default function AchievementToaster() {
  const [queue, setQueue] = useState<UnlockedAchievement[]>([]);

  useEffect(() => onAchievements((achievements) => setQueue((prev) => [...prev, ...achievements])), []);

  useEffect(() => {
    if (queue.length === 0) return;
    const t = setTimeout(() => setQueue((prev) => prev.slice(1)), 3500);
    return () => clearTimeout(t);
  }, [queue]);

  const current = queue[0];
  if (!current) return null;

  return (
    <div
      key={current.key}
      className="fixed top-4 left-1/2 -translate-x-1/2 z-30 bg-gray-900 text-white rounded-2xl px-4 py-3 shadow-lg flex items-center gap-3 max-w-[90%]"
    >
      <span className="text-2xl">🏆</span>
      <div>
        <p className="font-semibold text-sm leading-tight">Badge ontgrendeld: {current.title}</p>
        <p className="text-xs text-gray-300">{current.description}</p>
      </div>
    </div>
  );
}
