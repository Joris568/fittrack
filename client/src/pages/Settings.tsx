import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../api/client.js";
import { BodyMetric } from "../api/types.js";
import { useAuth } from "../context/AuthContext.js";
import { Button, Card, Input, PageTitle } from "../components/ui.js";

export default function SettingsPage() {
  const { logout } = useAuth();
  const navigate = useNavigate();
  const [metrics, setMetrics] = useState<BodyMetric[]>([]);
  const [weight, setWeight] = useState("");
  const [bodyFat, setBodyFat] = useState("");

  async function load() {
    setMetrics(await api.get<BodyMetric[]>("/body-metrics"));
  }

  useEffect(() => {
    load();
  }, []);

  async function addMetric(e: React.FormEvent) {
    e.preventDefault();
    if (!weight) return;
    await api.post("/body-metrics", {
      weightKg: Number(weight),
      bodyFatPct: bodyFat ? Number(bodyFat) : undefined,
    });
    setWeight("");
    setBodyFat("");
    load();
  }

  async function handleLogout() {
    await logout();
    navigate("/login");
  }

  return (
    <div className="space-y-4">
      <PageTitle>Meer</PageTitle>

      <Card>
        <h2 className="font-semibold mb-2">Lichaamsgewicht loggen</h2>
        <form onSubmit={addMetric} className="flex gap-2">
          <Input
            type="number"
            placeholder="Gewicht (kg)"
            value={weight}
            onChange={(e) => setWeight(e.target.value)}
          />
          <Input
            type="number"
            placeholder="Vet % (optioneel)"
            value={bodyFat}
            onChange={(e) => setBodyFat(e.target.value)}
          />
          <Button type="submit">Log</Button>
        </form>
        {metrics.length > 0 && (
          <div className="mt-3 space-y-1">
            {metrics.slice(0, 5).map((m) => (
              <p key={m.id} className="text-sm text-gray-600">
                {new Date(m.date).toLocaleDateString("nl-NL")}: {m.weightKg}kg
                {m.bodyFatPct ? ` · ${m.bodyFatPct}%` : ""}
              </p>
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
