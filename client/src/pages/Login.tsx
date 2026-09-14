import { useState } from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext.js";
import { Button, Input, Card } from "../components/ui.js";
import { ApiError } from "../api/client.js";

export default function Login() {
  const { authenticated, login } = useAuth();
  const [passphrase, setPassphrase] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  if (authenticated) return <Navigate to="/" replace />;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      await login(passphrase);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Inloggen mislukt");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-6 bg-bg">
      <Card className="w-full max-w-sm">
        <div className="text-center mb-6">
          <div className="text-4xl mb-2">💪</div>
          <h1 className="text-xl font-bold">FitTrack</h1>
          <p className="text-gray-400 text-sm">Jouw persoonlijke training & voeding</p>
        </div>
        <form onSubmit={handleSubmit} className="space-y-3">
          <Input
            type="password"
            placeholder="Wachtwoord"
            value={passphrase}
            onChange={(e) => setPassphrase(e.target.value)}
            autoFocus
          />
          {error && <p className="text-red-500 text-sm">{error}</p>}
          <Button type="submit" className="w-full" disabled={loading || !passphrase}>
            {loading ? "Bezig..." : "Inloggen"}
          </Button>
        </form>
      </Card>
    </div>
  );
}
