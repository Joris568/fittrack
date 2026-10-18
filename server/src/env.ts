import "dotenv/config";

function required(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required env var: ${name}`);
  }
  return value;
}

// In production (Render) PORT is injected by the platform and must be respected.
// In local dev, ignore any inherited PORT (e.g. from a dev-preview harness meant
// for the Vite client) so the API always binds to a fixed, predictable port.
const isProduction = process.env.NODE_ENV === "production";

export const env = {
  port: Number((isProduction ? process.env.PORT : undefined) ?? 4000),
  databaseUrl: required("DATABASE_URL"),
  appPassword: required("APP_PASSWORD"),
  jwtSecret: required("JWT_SECRET"),
  // Strip whitespace/newlines/quotes that sneak in when a key is pasted into a dashboard —
  // an invalid character in the header makes every request fail with "Connection error".
  anthropicApiKey: (process.env.ANTHROPIC_API_KEY ?? "").replace(/[\s"']/g, ""),
  anthropicModel: (process.env.ANTHROPIC_MODEL ?? "").trim() || "claude-sonnet-5",
  // Cheaper model for small daily jobs (check-in, nutrition tip). If the id is unknown on
  // this API key, calls fall back to the main model automatically.
  anthropicFastModel: (process.env.ANTHROPIC_MODEL_FAST ?? "").trim() || "claude-haiku-4-5-20251001",
  userEmail: process.env.APP_USER_EMAIL ?? "me@fittrack.local",
  nodeEnv: process.env.NODE_ENV ?? "development",
};
