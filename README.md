# FitTrack

Persoonlijke training- en voedingsapp met een AI-coach die je data kent: trainingen bouwen en bijhouden, eten loggen via een echte voedingsdatabase, en Claude die actief meedenkt (chat, programma-optimalisatie, dagelijks voedingsadvies, wekelijkse rapportages).

## Stack
- **Server**: Express + TypeScript, serveert ook de gebouwde React-app (één service).
- **Client**: React + Vite + Tailwind, mobile-first.
- **Database**: Postgres via Prisma.
- **AI**: Anthropic API (Claude), server-side only.
- **Voeding**: Open Food Facts (gratis, geen key nodig).

## Lokaal draaien

1. **Postgres-database**: maak een gratis database op [neon.tech](https://neon.tech) (account zelf aanmaken) en kopieer de connection string.
2. Kopieer `server/.env.example` naar `server/.env` en vul in:
   - `DATABASE_URL` — de Neon connection string
   - `APP_PASSWORD` — het wachtwoord waarmee je zelf inlogt in de app
   - `JWT_SECRET` — een willekeurige lange string
   - `ANTHROPIC_API_KEY` — je Anthropic API key (console.anthropic.com), nodig voor alle AI-features
3. Installeer dependencies en zet de database op:
   ```bash
   npm install
   npm run db:push
   npm run seed
   ```
4. Start de app (2 terminals, of gebruik een process manager):
   ```bash
   npm run dev:server
   npm run dev:client
   ```
5. Open http://localhost:5173

## Deployen (gratis)

1. **Neon** (database): maak een account op [neon.tech](https://neon.tech), maak een project/database aan, kopieer de connection string.
2. **Render** (hosting): maak een account op [render.com](https://render.com), verbind deze repository, en gebruik `render.yaml` (Blueprint) of maak handmatig een "Web Service" aan met:
   - Build command: `npm install && npm run build && npm run db:push && npm run seed`
   - Start command: `npm run start`
3. Zet in Render de environment variables (zie `server/.env.example`): `DATABASE_URL`, `APP_PASSWORD`, `JWT_SECRET`, `ANTHROPIC_API_KEY`.
4. Na de eerste deploy: open de Render-URL en log in met je `APP_PASSWORD` — de oefeningenbibliotheek is dan al geseed (elke build synct het schema en seedt opnieuw, dat is veilig want het overslaat oefeningen die al bestaan).

De Render gratis web-service "slaapt" na inactiviteit (eerste request na een tijdje kan een paar seconden traag zijn) — dat is de prijs van gratis hosting, verder werkt alles normaal.

## AI-kosten

De AI-features (coach chat, programma-suggesties, voedingsadvies, wekelijkse rapportages) gebruiken de Claude API en kosten een klein bedrag per gebruik (geen abonnement). Bij normaal persoonlijk gebruik gaat het om centen tot een paar euro per maand.

## Structuur

- `server/` — Express API + Prisma schema (`server/prisma/schema.prisma`) + AI-integratie (`server/src/routes/ai/`)
- `client/` — React app (`client/src/pages/`)
- `render.yaml` — deploy-blueprint voor Render
