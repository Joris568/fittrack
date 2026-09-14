import { NavLink } from "react-router-dom";
import AchievementToaster from "./AchievementToaster.js";

const tabs = [
  { to: "/", label: "Vandaag", icon: "🏠" },
  { to: "/train", label: "Trainen", icon: "🏋️" },
  { to: "/eat", label: "Eten", icon: "🍽️" },
  { to: "/coach", label: "Coach", icon: "🤖" },
  { to: "/settings", label: "Meer", icon: "⚙️" },
];

export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex flex-col">
      <AchievementToaster />
      <main className="flex-1 pb-20 max-w-2xl w-full mx-auto px-4 pt-4">{children}</main>
      <nav className="fixed bottom-0 left-0 right-0 bg-surface border-t border-gray-200 flex justify-around items-stretch pb-[env(safe-area-inset-bottom)] z-20">
        {tabs.map((tab) => (
          <NavLink
            key={tab.to}
            to={tab.to}
            end={tab.to === "/"}
            className={({ isActive }) =>
              `flex-1 flex flex-col items-center justify-center gap-0.5 py-2 text-xs font-medium ${
                isActive ? "text-brand-600" : "text-gray-400"
              }`
            }
          >
            <span className="text-lg leading-none">{tab.icon}</span>
            {tab.label}
          </NavLink>
        ))}
      </nav>
    </div>
  );
}
