import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";
import { api } from "../api/client.js";
import { BodyMetric, GamificationSummary, ProgressPhoto } from "../api/types.js";
import { useAuth } from "../context/AuthContext.js";
import { Button, Card, Input, PageTitle } from "../components/ui.js";
import { resizeImageToDataUrl } from "../lib/image.js";
import NotificationSettings from "../components/NotificationSettings.js";

export default function SettingsPage() {
  const { logout } = useAuth();
  const navigate = useNavigate();
  const [metrics, setMetrics] = useState<BodyMetric[]>([]);
  const [weight, setWeight] = useState("");
  const [bodyFat, setBodyFat] = useState("");
  const [showMeasurements, setShowMeasurements] = useState(false);
  const [measurements, setMeasurements] = useState({ waist: "", shoulder: "", chest: "", arm: "", thigh: "", hip: "" });
  const [gamification, setGamification] = useState<GamificationSummary | null>(null);
  const [photos, setPhotos] = useState<ProgressPhoto[]>([]);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [photoError, setPhotoError] = useState<string | null>(null);
  const [usage, setUsage] = useState<{
    total: { calls: number; inputTokens: number; outputTokens: number; cacheReadTokens: number; cacheWriteTokens: number };
    byLabel: { label: string; calls: number; inputTokens: number; outputTokens: number }[];
  } | null>(null);
  const [importing, setImporting] = useState(false);
  const [importUnit, setImportUnit] = useState<"kg" | "lbs">("kg");
  const [importResult, setImportResult] = useState<string | null>(null);
  const importInputRef = useRef<HTMLInputElement>(null);
  const [storage, setStorage] = useState<{ photoCount: number; photoBytes: number; chatImageBytes: number } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  async function load() {
    setMetrics(await api.get<BodyMetric[]>("/body-metrics"));
  }

  useEffect(() => {
    load();
    api.get<GamificationSummary>("/gamification/summary").then(setGamification);
    api.get<ProgressPhoto[]>("/progress-photos").then(setPhotos);
    api.get<{ photoCount: number; photoBytes: number; chatImageBytes: number }>("/export/storage").then(setStorage).catch(() => {});
    api.get<NonNullable<typeof usage>>("/export/usage").then(setUsage).catch(() => {});
  }, []);

  async function addMetric(e: React.FormEvent) {
    e.preventDefault();
    if (!weight) return;
    await api.post("/body-metrics", {
      weightKg: Number(weight),
      bodyFatPct: bodyFat ? Number(bodyFat) : undefined,
      waistCm: measurements.waist ? Number(measurements.waist) : undefined,
      shoulderCm: measurements.shoulder ? Number(measurements.shoulder) : undefined,
      chestCm: measurements.chest ? Number(measurements.chest) : undefined,
      armCm: measurements.arm ? Number(measurements.arm) : undefined,
      thighCm: measurements.thigh ? Number(measurements.thigh) : undefined,
      hipCm: measurements.hip ? Number(measurements.hip) : undefined,
    });
    setWeight("");
    setBodyFat("");
    setMeasurements({ waist: "", shoulder: "", chest: "", arm: "", thigh: "", hip: "" });
    load();
  }

  async function handlePhotoSelected(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    e.target.value = "";
    if (files.length === 0) return;
    setUploadingPhoto(true);
    setPhotoError(null);
    try {
      for (const file of files) {
        const dataUrl = await resizeImageToDataUrl(file);
        const photo = await api.post<ProgressPhoto>("/progress-photos", { imageData: dataUrl });
        setPhotos((prev) => [photo, ...prev]);
      }
    } catch (err) {
      setPhotoError(err instanceof Error ? err.message : "Uploaden mislukt");
    } finally {
      setUploadingPhoto(false);
    }
  }

  async function handleImport(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setImporting(true);
    setImportResult(null);
    try {
      const csv = await file.text();
      const r = await api.post<{ sessions: number; sets: number; newExercises: string[]; skippedRows: number; duplicateSessions: number }>("/import/workouts", { csv, unit: importUnit });
      setImportResult(
        `${r.sessions} trainingen en ${r.sets} sets geïmporteerd` +
          (r.duplicateSessions ? `, ${r.duplicateSessions} stonden er al` : "") +
          (r.newExercises.length ? `. Nieuwe oefeningen: ${r.newExercises.slice(0, 6).join(", ")}${r.newExercises.length > 6 ? "…" : ""}` : ".")
      );
    } catch (err) {
      setImportResult(err instanceof Error ? err.message : "Importeren mislukt.");
    } finally {
      setImporting(false);
    }
  }

  async function deletePhoto(id: string) {
    await api.delete(`/progress-photos/${id}`);
    setPhotos((prev) => prev.filter((p) => p.id !== id));
  }

  async function handleLogout() {
    await logout();
    navigate("/login");
  }

  const weightChartData = useMemo(
    () =>
      [...metrics]
        .reverse()
        .map((m) => ({
          date: new Date(m.date).toLocaleDateString("nl-NL", { day: "2-digit", month: "2-digit" }),
          weight: m.weightKg,
        })),
    [metrics]
  );

  return (
    <div className="space-y-4">
      <PageTitle>Meer</PageTitle>

      {gamification && (
        <Card>
          <h2 className="font-semibold mb-3">
            Badges ({gamification.achievements.filter((a) => a.unlocked).length}/{gamification.achievements.length})
          </h2>
          <div className="grid grid-cols-2 gap-2">
            {gamification.achievements.map((a) => (
              <div
                key={a.key}
                className={`rounded-xl px-3 py-2.5 ${a.unlocked ? "bg-brand-50" : "bg-gray-50 opacity-50"}`}
              >
                <p className={`text-sm font-medium ${a.unlocked ? "text-brand-700" : "text-gray-500"}`}>
                  {a.title}
                </p>
                <p className="text-xs text-gray-400 mt-0.5">{a.description}</p>
              </div>
            ))}
          </div>
        </Card>
      )}

      <Card>
        <h2 className="font-semibold mb-2">Lichaamsgewicht loggen</h2>
        <form onSubmit={addMetric} className="flex gap-2">
          <Input
            type="number"
            inputMode="decimal"
            step="0.1"
            placeholder="Gewicht (kg)"
            value={weight}
            onChange={(e) => setWeight(e.target.value)}
          />
          <Input
            type="number"
            inputMode="decimal"
            step="0.1"
            placeholder="Vet % (optioneel)"
            value={bodyFat}
            onChange={(e) => setBodyFat(e.target.value)}
          />
          <Button type="submit">Log</Button>
        </form>
        <button
          type="button"
          className="text-xs text-brand-600 font-medium mt-2"
          onClick={() => setShowMeasurements((v) => !v)}
        >
          {showMeasurements ? "▲" : "▼"} Lichaamsmaten toevoegen (optioneel)
        </button>
        {showMeasurements && (
          <form onSubmit={addMetric} className="grid grid-cols-2 gap-2 mt-2">
            <Input
              type="number"
              inputMode="decimal"
              placeholder="Taille (cm)"
              value={measurements.waist}
              onChange={(e) => setMeasurements((m) => ({ ...m, waist: e.target.value }))}
            />
            <Input
              type="number"
              inputMode="decimal"
              placeholder="Schouders (cm)"
              value={measurements.shoulder}
              onChange={(e) => setMeasurements((m) => ({ ...m, shoulder: e.target.value }))}
            />
            <Input
              type="number"
              inputMode="decimal"
              placeholder="Borst (cm)"
              value={measurements.chest}
              onChange={(e) => setMeasurements((m) => ({ ...m, chest: e.target.value }))}
            />
            <Input
              type="number"
              inputMode="decimal"
              placeholder="Arm (cm)"
              value={measurements.arm}
              onChange={(e) => setMeasurements((m) => ({ ...m, arm: e.target.value }))}
            />
            <Input
              type="number"
              inputMode="decimal"
              placeholder="Bovenbeen (cm)"
              value={measurements.thigh}
              onChange={(e) => setMeasurements((m) => ({ ...m, thigh: e.target.value }))}
            />
            <Input
              type="number"
              inputMode="decimal"
              placeholder="Heup (cm)"
              value={measurements.hip}
              onChange={(e) => setMeasurements((m) => ({ ...m, hip: e.target.value }))}
            />
            <p className="text-xs text-gray-400 col-span-2">
              Wordt meegenomen bij je volgende gewichtslog hierboven. Voor je V-taper score: meet je schouders rondom op het breedste punt (over je delts, armen ontspannen) en je taille op navelhoogte, steeds op dezelfde manier.
            </p>
          </form>
        )}
        {weightChartData.length > 1 && (
          <ResponsiveContainer width="100%" height={160} className="mt-3">
            <LineChart data={weightChartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#E2DED5" />
              <XAxis dataKey="date" fontSize={10} tick={{ fill: "#7C776C" }} />
              <YAxis
                fontSize={10}
                width={35}
                domain={["dataMin - 1", "dataMax + 1"]}
                tick={{ fill: "#7C776C" }}
              />
              <Tooltip contentStyle={{ background: "#FFFFFF", border: "1px solid #E2DED5", color: "#161512", borderRadius: 8 }} />
              <Line
                type="monotone"
                dataKey="weight"
                stroke="#E5481A"
                strokeWidth={2}
                dot={{ r: 2, fill: "#E5481A" }}
                isAnimationActive={false}
              />
            </LineChart>
          </ResponsiveContainer>
        )}
        {metrics.length > 0 && (
          <div className="mt-3 space-y-1">
            {metrics.slice(0, 5).map((m) => (
              <p key={m.id} className="text-sm text-gray-600">
                {new Date(m.date).toLocaleDateString("nl-NL")}: {m.weightKg}kg
                {m.bodyFatPct ? ` · ${m.bodyFatPct}%` : ""}
                {m.waistCm ? ` · taille ${m.waistCm}cm` : ""}
                {m.chestCm ? ` · borst ${m.chestCm}cm` : ""}
                {m.armCm ? ` · arm ${m.armCm}cm` : ""}
                {m.thighCm ? ` · bovenbeen ${m.thighCm}cm` : ""}
                {m.hipCm ? ` · heup ${m.hipCm}cm` : ""}
              </p>
            ))}
          </div>
        )}
      </Card>

      <Card>
        <div className="flex justify-between items-center mb-2">
          <h2 className="font-semibold">
            Voortgangsfoto&apos;s{" "}
            {photos.length >= 2 && (
              <Link to="/photos" className="ml-1 text-xs font-medium text-brand-600">
                vergelijk
              </Link>
            )}
          </h2>
          <Button
            variant="secondary"
            className="!px-3 !py-1.5 text-sm"
            onClick={() => fileInputRef.current?.click()}
            disabled={uploadingPhoto}
          >
            {uploadingPhoto ? "Bezig..." : "+ Foto"}
          </Button>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            multiple
            className="hidden"
            onChange={handlePhotoSelected}
          />
        </div>
        {photoError && <p className="text-sm text-red-500 mb-2">{photoError}</p>}
        {photos.length === 0 ? (
          <p className="text-sm text-gray-400">Nog geen foto&apos;s. Handig om je voortgang visueel te zien.</p>
        ) : (
          <div className="grid grid-cols-3 gap-2">
            {photos.map((p) => (
              <div key={p.id} className="relative aspect-square">
                <img src={p.imageData} alt="" className="w-full h-full object-cover rounded-lg" />
                <p className="absolute bottom-1 left-1 text-[10px] bg-black/50 text-white px-1 rounded">
                  {new Date(p.date).toLocaleDateString("nl-NL", { day: "2-digit", month: "2-digit" })}
                </p>
                <button
                  className="absolute top-1 right-1 w-5 h-5 bg-black/50 text-white rounded-full text-xs"
                  onClick={() => deletePhoto(p.id)}
                >
                  ✕
                </button>
              </div>
            ))}
          </div>
        )}
      </Card>

      <Link to="/profile" className="block">
        <Card className="flex items-center justify-between">
          <div>
            <p className="font-semibold">Mijn profiel</p>
            <p className="text-xs text-gray-500">Lengte, doel, trainingsdagen en wat de coach onthoudt</p>
          </div>
          <span className="text-gray-400">›</span>
        </Card>
      </Link>

      <Link to="/recap" className="block">
        <Card className="flex items-center justify-between">
          <div>
            <p className="font-semibold">Maandoverzicht</p>
            <p className="text-xs text-gray-500">Wat je tilde, je records en je consistentie, om te delen</p>
          </div>
          <span className="text-gray-400">›</span>
        </Card>
      </Link>

      <NotificationSettings />

      {usage && (
        <Card>
          <h2 className="font-semibold mb-1">AI-verbruik deze maand</h2>
          <p className="text-xs text-gray-500 mb-3">
            Zo houd je in de gaten wat de coach kost. Het exacte saldo zie je in je Anthropic-console onder Billing.
          </p>
          <div className="grid grid-cols-3 gap-2 text-center mb-3">
            {[
              { v: usage.total.calls, l: "aanvragen" },
              { v: Math.round((usage.total.inputTokens + usage.total.cacheReadTokens + usage.total.cacheWriteTokens) / 1000), l: "k invoer" },
              { v: Math.round(usage.total.outputTokens / 1000), l: "k uitvoer" },
            ].map((x) => (
              <div key={x.l} className="rounded-lg bg-gray-50 py-2">
                <p className="font-display font-bold text-xl leading-none">{x.v}</p>
                <p className="text-[10px] text-gray-500 mt-1">{x.l}</p>
              </div>
            ))}
          </div>
          {usage.total.cacheReadTokens > 0 && (
            <p className="text-xs text-gray-500 mb-2">
              {Math.round(usage.total.cacheReadTokens / 1000)}k invoer kwam uit de cache (veel goedkoper).
            </p>
          )}
          <div className="space-y-1">
            {usage.byLabel.map((b) => (
              <div key={b.label} className="flex justify-between text-xs text-gray-600">
                <span>{b.label}</span>
                <span>
                  {b.calls}x · {Math.round(b.inputTokens / 1000)}k in / {Math.round(b.outputTokens / 1000)}k uit
                </span>
              </div>
            ))}
          </div>
        </Card>
      )}

      <Card>
        <h2 className="font-semibold mb-1">Trainingen importeren</h2>
        <p className="text-xs text-gray-500 mb-3">
          Kom je uit Strong of Hevy? Exporteer daar je trainingen als CSV en kies het bestand hier. Je records en suggesties werken dan meteen op je oude data.
        </p>
        <div className="flex gap-2 mb-2">
          {(["kg", "lbs"] as const).map((u) => (
            <button
              key={u}
              type="button"
              onClick={() => setImportUnit(u)}
              className={`flex-1 py-2 rounded-lg text-sm font-semibold border ${importUnit === u ? "bg-gray-900 text-white border-gray-900" : "bg-surface text-gray-600 border-gray-200"}`}
            >
              Gewichten in {u}
            </button>
          ))}
        </div>
        <input ref={importInputRef} type="file" accept=".csv,text/csv" className="hidden" onChange={handleImport} />
        <Button variant="secondary" className="w-full" onClick={() => importInputRef.current?.click()} disabled={importing}>
          {importing ? "Importeren..." : "Kies CSV-bestand"}
        </Button>
        {importResult && <p className="text-sm text-gray-700 mt-2">{importResult}</p>}
      </Card>

      <Card>
        <h2 className="font-semibold mb-1">Back-up &amp; opslag</h2>
        <p className="text-xs text-gray-500 mb-3">
          Download al je data als bestand, zodat je nooit afhankelijk bent van één database.
          {storage && (
            <>
              {" "}
              Foto&apos;s nemen {(storage.photoBytes / 1_048_576).toFixed(1)} MB in ({storage.photoCount} stuks), chat-bijlagen{" "}
              {(storage.chatImageBytes / 1_048_576).toFixed(1)} MB (worden na 7 dagen opgeruimd).
            </>
          )}
        </p>
        <div className="flex gap-2">
          <a href="/api/export" className="flex-1 text-center px-4 py-2.5 rounded-lg text-sm font-medium bg-gray-100 border border-gray-200 text-gray-800">
            Back-up (zonder foto&apos;s)
          </a>
          <a href="/api/export?photos=1" className="flex-1 text-center px-4 py-2.5 rounded-lg text-sm font-medium bg-gray-100 border border-gray-200 text-gray-800">
            Met foto&apos;s
          </a>
        </div>
      </Card>

      <Button variant="danger" className="w-full" onClick={handleLogout}>
        Uitloggen
      </Button>
    </div>
  );
}
