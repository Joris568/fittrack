// Rewrites the Prisma datasource provider in schema.prisma. Local dev ships with
// sqlite (zero setup); the production build (see render.yaml) switches it to
// postgresql before generating the client, so there is nothing to remember to
// toggle by hand.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const provider = process.argv[2];
if (!["sqlite", "postgresql"].includes(provider)) {
  console.error("Usage: node set-datasource.js <sqlite|postgresql>");
  process.exit(1);
}

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const schemaPath = path.join(__dirname, "../prisma/schema.prisma");
const content = fs.readFileSync(schemaPath, "utf8");
const updated = content.replace(/provider\s*=\s*"(sqlite|postgresql)"/, `provider = "${provider}"`);
fs.writeFileSync(schemaPath, updated);
console.log(`Datasource provider set to ${provider}`);
