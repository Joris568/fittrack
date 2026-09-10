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
  anthropicApiKey: process.env.ANTHROPIC_API_KEY ?? "",
  anthropicModel: process.env.ANTHROPIC_MODEL ?? "claude-sonnet-5",
  userEmail: process.env.APP_USER_EMAIL ?? "me@fittrack.local",
  nodeEnv: process.env.NODE_ENV ?? "development",
};
