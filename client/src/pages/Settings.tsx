import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";
import { api } from "../api/client.js";
import { BodyMetric, GamificationSummary, ProgressPhoto } from "../api/types.js";
import { useAuth } from "../context/AuthContext.js";
import { Button, Card, Input, PageTitle } from "../components/ui.js";
import { resizeImageToDataUrl } from "../lib/image.js";

export default function SettingsPage() {
  const { logout } = useAuth();
  const navigate = useNavigate();
  const [metrics, setMetrics] = useState<BodyMetric[]>([]);
  const [weight, setWeight] = useState("");
  const [bodyFat, setBodyFat] = useState("");
  const [showMeasurements, setShowMeasurements] = useState(false);
  const [measurements, setMeasurements] = useState({ waist: "", chest: "", arm: "", thigh: "", hip: "" });
  const [gamification, setGamification] = useState<GamificationSummary | null>(null);
  const [photos, setPhotos] = useState<ProgressPhoto[]>([]);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [photoError, setPhotoError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  async function load() {
    setMetrics(await api.get<BodyMetric[]>("/body-metrics"));
  }

  useEffect(() => {
    load();
    api.get<GamificationSummary>("/gamification/summary").then(setGamification);
    api.get<ProgressPhoto[]>("/progress-photos").then(setPhotos);
  }, []);

  async function addMetric(e: React.FormEvent) {
    e.preventDefault();
    if (!weight) return;
    await api.post("/body-metrics", {
      weightKg: Number(weight),
      bodyFatPct: bodyFat ? Number(bodyFat) : undefined,
      waistCm: measurements.waist ? Number(measurements.waist) : undefined,
      chestCm: measurements.chest ? Number(measurements.chest) : undefined,
      armCm: measurements.arm ? Number(measurements.arm) : undefined,
      thighCm: measurements.thigh ? Number(measurements.thigh) : undefined,
      hipCm: measurements.hip ? Number(measurements.hip) : undefined,
    });
    setWeight("");
    setBodyFat("");
    setMeasurements({ waist: "", chest: "", arm: "", thigh: "", hip: "" });
    load();
  }

  async function handlePhotoSelected(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setUploadingPhoto(true);
    setPhotoError(null);
    try {
      const dataUrl = await resizeImageToDataUrl(file);
      const photo = await api.post<ProgressPhoto>("/progress-photos", { imageData: dataUrl });
      setPhotos((prev) => [photo, ...prev]);
    } catch (err) {
      setPhotoError(err instanceof Error ? err.message : "Uploaden mislukt");
    } finally {
      setUploadingPhoto(false);
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
                  {a.unlocked ? "🏅" : "🔒"} {a.title}
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
              Wordt meegenomen bij je volgende gewichtslog hierboven.
            </p>
          </form>
        )}
        {weightChartData.length > 1 && (
          <ResponsiveContainer width="100%" height={160} className="mt-3">
            <LineChart data={weightChartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#eee" />
              <XAxis dataKey="date" fontSize={10} />
              <YAxis fontSize={10} width={35} domain={["dataMin - 1", "dataMax + 1"]} />
              <Tooltip />
              <Line
                type="monotone"
                dataKey="weight"
                stroke="#16b862"
                strokeWidth={2}
                dot={{ r: 2 }}
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
          <h2 className="font-semibold">Voortgangsfoto&apos;s</h2>
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
            capture="environment"
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

      <Button variant="danger" className="w-full" onClick={handleLogout}>
        Uitloggen
      </Button>
    </div>
  );
}
