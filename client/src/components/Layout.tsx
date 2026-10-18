import { useEffect, useState } from "react";
import { NavLink } from "react-router-dom";
import { flushQueue, getQueuedSets, subscribeQueue } from "../lib/offlineQueue.js";
import AchievementToaster from "./AchievementToaster.js";

function Icon({ children }: { children: React.ReactNode }) {
  return (
    <svg
      width="22"
      height="22"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {children}
    </svg>
  );
}

const tabs = [
  {
    to: "/",
    label: "Vandaag",
    icon: (
      <Icon>
        <path d="M4 11.5 12 5l8 6.5" />
        <path d="M6 10.5V19h12v-8.5" />
      </Icon>
    ),
  },
  {
    to: "/agenda",
    label: "Agenda",
    icon: (
      <Icon>
        <rect x="4" y="6" width="16" height="14" rx="2" />
        <path d="M4 10.5h16M8.5 4v4M15.5 4v4" />
      </Icon>
    ),
  },
  {
    to: "/train",
    label: "Trainen",
    icon: (
      <Icon>
        <path d="M6.5 7v10M17.5 7v10M3.5 9.5v5M20.5 9.5v5M6.5 12h11" />
      </Icon>
    ),
  },
  {
    to: "/eat",
    label: "Eten",
    icon: (
      <Icon>
        <path d="M7 4v6a2 2 0 0 0 4 0V4M9 4v16" />
        <path d="M16 20V4c-2 1.5-3 4-3 7h3" />
      </Icon>
    ),
  },
  {
    to: "/coach",
    label: "Coach",
    icon: (
      <Icon>
        <path d="M5 6h14a1 1 0 0 1 1 1v8a1 1 0 0 1-1 1h-7l-4 3v-3H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1Z" />
      </Icon>
    ),
  },
  {
    to: "/settings",
    label: "Meer",
    icon: (
      <Icon>
        <circle cx="6" cy="12" r="1" />
        <circle cx="12" cy="12" r="1" />
        <circle cx="18" cy="12" r="1" />
      </Icon>
    ),
  },
];

/** Keeps the app honest about connectivity: tells you when you're offline and syncs sets
 * logged without a connection as soon as it is back. */
function useOfflineSync() {
  const [online, setOnline] = useState(() => navigator.onLine);
  const [pending, setPending] = useState(() => getQueuedSets().length);

  useEffect(() => {
    const sync = () => {
      flushQueue().then((n) => {
        if (n > 0) window.dispatchEvent(new Event("fittrack:synced"));
      });
    };
    const goOnline = () => {
      setOnline(true);
      sync();
    };
    const goOffline = () => setOnline(false);
    window.addEventListener("online", goOnline);
    window.addEventListener("offline", goOffline);
    const unsubscribe = subscribeQueue(() => setPending(getQueuedSets().length));
    sync();
    const timer = setInterval(() => getQueuedSets().length > 0 && sync(), 15_000);
    return () => {
      window.removeEventListener("online", goOnline);
      window.removeEventListener("offline", goOffline);
      unsubscribe();
      clearInterval(timer);
    };
  }, []);

  return { online, pending };
}

export default function Layout({ children }: { children: React.ReactNode }) {
  const { online, pending } = useOfflineSync();
  return (
    <div className="min-h-screen flex flex-col">
      {(!online || pending > 0) && (
        <div className="bg-amber-100 text-amber-800 text-xs text-center px-3 py-1.5 font-medium">
          {!online ? "Geen verbinding" : "Synchroniseren"}
          {pending > 0 && ` — ${pending} ${pending === 1 ? "set wacht" : "sets wachten"} op verbinding`}
        </div>
      )}
      <AchievementToaster />
      <main className="flex-1 pb-20 max-w-2xl w-full mx-auto px-4 pt-5">{children}</main>
      <nav className="fixed bottom-0 left-0 right-0 bg-surface/95 backdrop-blur border-t border-gray-200 flex justify-around items-stretch pb-[env(safe-area-inset-bottom)] z-20">
        {tabs.map((tab) => (
          <NavLink
            key={tab.to}
            to={tab.to}
            end={tab.to === "/"}
            className={({ isActive }) =>
              `flex-1 flex flex-col items-center justify-center gap-1 py-2.5 text-[11px] font-medium ${
                isActive ? "text-gray-900" : "text-gray-400"
              }`
            }
          >
            {({ isActive }) => (
              <>
                <span className={isActive ? "text-brand-500" : ""}>{tab.icon}</span>
                {tab.label}
              </>
            )}
          </NavLink>
        ))}
      </nav>
    </div>
  );
}
