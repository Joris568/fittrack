import { useEffect, useState } from "react";
import { api } from "../api/client.js";
import { currentEndpoint, disablePush, enablePush, pushSupport } from "../lib/push.js";
import { Button, Card } from "./ui.js";

interface Settings {
  trainingOn: boolean;
  trainingTime: string;
  weighOn: boolean;
  weighTime: string;
  foodOn: boolean;
  foodTime: string;
  weeklyOn: boolean;
}

const ROWS: { on: keyof Settings; time?: keyof Settings; label: string; hint: string }[] = [
  { on: "trainingOn", time: "trainingTime", label: "Geplande training", hint: "Alleen als je die dag een training hebt gepland en nog niet bent begonnen" },
  { on: "weighOn", time: "weighTime", label: "Wegen", hint: "Alleen als je 3 dagen niet hebt gewogen" },
  { on: "foodOn", time: "foodTime", label: "Eten loggen", hint: "Alleen als je die dag nog weinig hebt gelogd" },
  { on: "weeklyOn", label: "Weekcheck en maandoverzicht", hint: "Maandagochtend en de 1e van de maand" },
];

/** Reminders as push notifications. Needs the app installed on iPhone, and the server awake. */
export default function NotificationSettings() {
  const support = pushSupport();
  const [subscribed, setSubscribed] = useState(false);
  const [settings, setSettings] = useState<Settings | null>(null);
  const [devices, setDevices] = useState(0);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function refresh() {
    const res = await api.get<{ settings: Settings; devices: number }>("/push/settings");
    setSettings(res.settings);
    setDevices(res.devices);
    setSubscribed((await currentEndpoint()) !== null);
  }

  useEffect(() => {
    refresh().catch(() => {});
  }, []);

  async function toggle() {
    setBusy(true);
    setMessage(null);
    try {
      if (subscribed) await disablePush();
      else await enablePush();
      await refresh();
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Meldingen aanzetten lukt niet.");
    } finally {
      setBusy(false);
    }
  }

  async function update(patch: Partial<Settings>) {
    setSettings((s) => (s ? { ...s, ...patch } : s));
    const res = await api.put<{ settings: Settings; devices: number }>("/push/settings", patch).catch(() => null);
    if (res) setSettings(res.settings);
  }

  async function test() {
    setBusy(true);
    setMessage(null);
    try {
      const r = await api.post<{ sent: number }>("/push/test");
      setMessage(r.sent > 0 ? "Testmelding verstuurd. Die komt zo binnen." : "Geen apparaat bereikt. Zet meldingen eerst aan op dit apparaat.");
    } catch {
      setMessage("Testmelding versturen mislukt.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card>
      <h2 className="font-semibold mb-1">Meldingen</h2>
      {support === "unsupported" && <p className="text-sm text-gray-500">Deze browser ondersteunt geen meldingen.</p>}
      {support === "needs-install" && (
        <p className="text-sm text-gray-600">
          Op een iPhone werken meldingen pas als je de app op je beginscherm hebt gezet: open de site in Safari, tik op het deel-icoon en kies <strong>Zet op beginscherm</strong>. Open de app daarna vanaf dat icoon en kom hier terug.
        </p>
      )}
      {support === "denied" && <p className="text-sm text-gray-600">Meldingen zijn geblokkeerd voor deze site. Zet ze aan in de instellingen van je browser of telefoon.</p>}
      {support === "ready" && (
        <>
          <p className="text-xs text-gray-500 mb-3">Een zetje op het juiste moment, en alleen als er echt iets te doen is.</p>
          <Button className="w-full" variant={subscribed ? "secondary" : "primary"} onClick={toggle} disabled={busy}>
            {subscribed ? "Meldingen uitzetten op dit apparaat" : "Meldingen aanzetten"}
          </Button>
          {settings && subscribed && (
            <div className="mt-4 space-y-3">
              {ROWS.map((r) => (
                <div key={r.on} className="flex items-center gap-3">
                  <button
                    type="button"
                    role="switch"
                    aria-checked={settings[r.on] as boolean}
                    onClick={() => update({ [r.on]: !settings[r.on] } as Partial<Settings>)}
                    className={`w-11 h-6 rounded-full shrink-0 relative transition-colors ${settings[r.on] ? "bg-brand-500" : "bg-gray-300"}`}
                  >
                    <span className={`absolute top-0.5 w-5 h-5 rounded-full bg-white transition-all ${settings[r.on] ? "left-[22px]" : "left-0.5"}`} />
                  </button>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium">{r.label}</p>
                    <p className="text-[11px] text-gray-400">{r.hint}</p>
                  </div>
                  {r.time && settings[r.on] && (
                    <input
                      type="time"
                      value={settings[r.time] as string}
                      onChange={(e) => e.target.value && update({ [r.time!]: e.target.value } as Partial<Settings>)}
                      className="rounded-lg border border-gray-200 bg-bg-raised px-2 py-1.5 text-sm"
                    />
                  )}
                </div>
              ))}
              <Button variant="secondary" className="w-full" onClick={test} disabled={busy}>
                Stuur een testmelding
              </Button>
              <p className="text-[11px] text-gray-400">{devices} {devices === 1 ? "apparaat" : "apparaten"} gekoppeld.</p>
            </div>
          )}
          <p className="text-[11px] text-gray-400 mt-3">
            Let op: de gratis server gaat na ongeveer 15 minuten slapen. Meldingen komen alleen aan als hij wakker blijft. Zet daarvoor gratis een ping aan, bijvoorbeeld bij uptimerobot.com, die elke 5 minuten je site-adres plus /api/health bezoekt.
          </p>
          {message && <p className="text-sm text-gray-700 mt-2">{message}</p>}
        </>
      )}
    </Card>
  );
}
