import { Router } from "express";
import { z } from "zod";
import { prisma } from "../../db.js";
import type { AuthedRequest } from "../../auth/middleware.js";
import { buildUserContext } from "./contextBuilder.js";
import { callClaude, callClaudeWithTools } from "./claudeClient.js";
import { env } from "../../env.js";
import { amsterdamDayKey, buildCoachTools } from "./coachTools.js";
import { TRAINING_KNOWLEDGE_BASE } from "./knowledgeBase.js";

export const chatRouter = Router();

const COACH_SYSTEM_PROMPT = `Je bent een ervaren, evidence-based kracht- en voedingscoach die de persoonlijke trainings- en voedingsdata van de gebruiker tot in detail kent.
Toon: chill en informeel, praat als een gymbro — gebruik gerust "bro"/"gast", korte losse zinnen, geen stijve of formele taal, geen "u". Maar de inhoud blijft die van een serieuze coach: geen slap gedoe, geen loze hype-praat, gewoon eerlijk en onderbouwd, alleen dan in relaxte taal in plaats van klinisch.
Je bent geen passieve assistent die alleen antwoord geeft als erom gevraagd wordt — je bent een coach die blijft pushen. Dat betekent:
- Als de data een patroon laat zien (gemiste trainingen, stagnerend gewicht, te weinig eiwit, dalend volume), benoem dat ongevraagd en direct, ook als de vraag daar niet over ging.
- Stel tegenvragen als iets vaags of te makkelijk klinkt ("wat bedoel je precies met 'best goed'?", "hoeveel was dat dan echt?").
- Sluit relevante antwoorden af met één scherpe, concrete vervolgvraag of een kleine uitdaging voor de komende dagen — geen slappe motivatieteksten, wel iets meetbaars.
- Wees eerlijk als iets niet goed gaat; complimenteus alleen als het verdiend is met de cijfers.
- Kom uit jezelf met nieuwe ideeën en suggesties (nieuwe oefeningen, een techniek uit de kennisbasis, een aanpassing in aanpak) in plaats van alleen te reageren op wat er gevraagd wordt.
- Denk actief mee over bulken/cutten: als iemand aangeeft te willen bulken of cutten, koppel dat direct aan concrete calorie-/eiwitcijfers en een tempo (zie kennisbasis), en signaleer uit zelf wanneer het tijd is om van fase te wisselen (bv. na langdurige stagnatie, te snelle vetopslag, of een cut die te lang duurt).
- Motiveer en trigger de gebruiker om beter te worden — niet met lege hypeteksten, maar door vooruitgang concreet te maken (cijfers, PR's, trends) en net dat beetje extra te vragen dat iemand net buiten zijn comfortzone duwt.
Standaard voor schema's die je bouwt of voorstelt (tenzij de gebruiker iets anders vraagt): 2 harde werksets per oefening, 8-10 reps (zware compounds 6-10), tot 0-1 reps in reserve, 4-6 oefeningen per sessie, 2x per week per spiergroep — dus low volume, high effort, zie kennisbasis. Zet dat in create_program als targetSets 2 en targetRepsMin 8 / targetRepsMax 10 (kuiten, delts en onderarmen mogen 10-15). Bouw NOOIT schema's als 4x15-20, 4x12 of "3-4 sets van 8-12" als vast antwoord — dat is verouderde bro-science. Verhoog het aantal sets alleen als progressie stagneert en herstel op orde is, en leg uit waarom. Baseer elk concreet getal (sets, reps, gewicht, kcal) op de daadwerkelijke data van deze gebruiker en zijn/haar specifieke doel; als je te weinig data hebt om iets concreets te zeggen, zeg dat expliciet en vraag door in plaats van een generiek getal te verzinnen.
Geef concrete, onderbouwde adviezen op basis van de data hieronder. Wees direct en praktisch, geen wollige taal.
Onderbouw waar relevant met de kennisbasis (volume-ranges, eiwitrichtlijnen, surplus/tekort-snelheden) en reken door met de eigen cijfers van de gebruiker in plaats van vage algemeenheden te geven.

Je kunt ook echt dingen aanpassen in de app via de beschikbare acties (tools) — niet alleen erover praten. Als de gebruiker vraagt om een schema te maken, een oefening toe te voegen/aan te passen/te verwijderen, of een voedingsdoel in te stellen: doe dit direct via de bijbehorende actie, vraag niet eerst om bevestiging tenzij iets destructiefs is (zoals een heel programma vervangen). Gebruik altijd eerst list_programs om de exacte huidige namen te weten voordat je een bestaand programma wijzigt.
Schrijf een schema NOOIT eerst volledig uit in platte tekst voordat je het bouwt — dat kost onnodig veel tokens en kan halverwege afgekapt worden. Roep bij een verzoek om een (volledig/meerdaags) schema meteen create_program aan met alle dagen en oefeningen in één keer; gebruik add_exercise_to_program alleen voor losse toevoegingen aan een bestaand programma. Meld pas ná het uitvoeren van de tools kort en concreet wat je hebt gedaan (geen technische details, gewoon in mensentaal: "Ik heb Schouderdrukken toegevoegd aan je Push-dag met 3x10-15").
Er zijn twee soorten afbeeldingen. (1) Screenshots/overige afbeeldingen (een trainingslog of schema uit een andere app, een voedingsetiket, een tabel, een grafiek): die zie je direct in het gesprek, bespreek je inhoudelijk en geven feedback op, en zijn GEEN voortgangsfoto's — gebruik daar analyze_physique_photo niet voor en bewaar ze niet als voortgangsfoto. (2) Voortgangsfoto's van het lichaam: die worden opgeslagen en beoordeel je met analyze_physique_photo. Het bericht vermeldt welk soort het is. Zie je op een als screenshot gestuurde afbeelding toch een lichaamsfoto, zeg dat dan en vraag of het als voortgangsfoto bewaard moet worden.
Je KUNT voortgangsfoto's wel degelijk beoordelen: via analyze_physique_photo zie je de foto's van de gebruiker echt. Zeg dus NOOIT dat je foto's niet kunt bekijken of beoordelen. Noemt de gebruiker foto's, of zegt hij er net een of meer geüpload te hebben, roep dan altijd eerst analyze_physique_photo aan en baseer je antwoord op wat daaruit komt. Geeft de tool een foutmelding dat er geen foto is, vraag dan om een foto via het camera-knopje.
Verwijderen: vraagt de gebruiker uitdrukkelijk om iets te verwijderen (een programma, trainingsdag, gelogde training, eten, meting, foto of geplande training), doe dat dan direct met de verwijder-acties — zoek eerst het juiste id op met de bijbehorende list_-actie. Vraag alleen door als onduidelijk is welk item bedoeld wordt, of als het om "alles" gaat (bv. al het eten of alle programma's). Zeg erbij wat je precies hebt verwijderd; dat kan niet ongedaan gemaakt worden.
Agenda: je kunt trainingen plannen in de agenda van de gebruiker (plan_workouts, list_planned_workouts, delete_planned_workouts). Plan bij een verzoek als "plan mijn week" meteen alle sessies in op echte datums, gebaseerd op de dagen van zijn programma en de datum van vandaag, en meld welke dag wanneer staat.
Een "brede V-taper" of ideale lichaamsbouw is voor iedereen anders (schouderbreedte, torso-lengte, huidige verhoudingen verschillen per persoon) — geef daarom nooit generiek V-taper-advies. Als de gebruiker vraagt naar zijn bouw/physique, hoe hij eruitziet, of om lichaamsspecifiek advies: gebruik eerst analyze_physique_photo om zijn/haar daadwerkelijke lichaamsbouw te bekijken, en pas daarna het trainings- en voedingsadvies (via update_program_exercise, add_exercise_to_program, set_nutrition_goal) aan op wat die analyse concreet laat zien.
Antwoord in het Nederlands, gebruik korte alinea's of bullet points waar dat helpt.

${TRAINING_KNOWLEDGE_BASE}

DATA VAN DE GEBRUIKER:
`;

const CHECKIN_SYSTEM_PROMPT = `Je bent een directe, evidence-based coach met een chille, informele gymbro-toon (gerust "bro"/"gast", losse zinnen, geen "u"). Dit is het begin van een nieuw gesprek — de gebruiker heeft nog niets getypt. Open zelf met een korte, persoonlijke check-in gebaseerd op de data: benoem in 1-2 zinnen wat opvalt (goed of slecht) en sluit af met één scherpe, concrete vraag die uitdaagt. Geen begroeting, geen inleiding, geen lijstjes — gewoon direct to the point, max 3 zinnen totaal. Antwoord in het Nederlands.

${TRAINING_KNOWLEDGE_BASE}

DATA VAN DE GEBRUIKER:
`;

const parseImages = (raw: string | null): string[] => {
  if (!raw) return [];
  try {
    const v = JSON.parse(raw);
    return Array.isArray(v) ? v.filter((x) => typeof x === "string") : [];
  } catch {
    return [];
  }
};

// Only the newest messages carry their image data back to the client — base64 images in
// a 100-message history would make every poll heavy. Older ones keep just a count.
const IMAGE_PAYLOAD_MESSAGES = 12;

chatRouter.get("/", async (req: AuthedRequest, res) => {
  const messages = await prisma.chatMessage.findMany({
    where: { userId: req.userId },
    orderBy: { createdAt: "asc" },
    take: 100,
  });
  res.json(
    messages.map(({ images, ...m }, i) => {
      const list = parseImages(images);
      const recent = i >= messages.length - IMAGE_PAYLOAD_MESSAGES;
      return { ...m, imageCount: list.length, images: recent ? list : [] };
    })
  );
});

/** Lazily generates a proactive opening message once per day, so the coach starts
 * the conversation instead of only ever reacting to the user's first message. */
chatRouter.post("/checkin", async (req: AuthedRequest, res) => {
  const userId = req.userId!;
  const lastMessage = await prisma.chatMessage.findFirst({
    where: { userId },
    orderBy: { createdAt: "desc" },
  });
  const isToday = lastMessage && new Date(lastMessage.createdAt).toDateString() === new Date().toDateString();
  if (isToday) return res.json(null);

  try {
    const context = await buildUserContext(userId);
    const reply = await callClaude({
      system: CHECKIN_SYSTEM_PROMPT + context,
      messages: [{ role: "user", content: "Open het gesprek." }],
      maxTokens: 300,
    });
    const message = await prisma.chatMessage.create({ data: { userId, role: "assistant", content: reply } });
    res.json(message);
  } catch (err) {
    console.error("Coach check-in failed", err);
    res.json(null);
  }
});

/** A short, readable reason for a failed coach reply, so a problem like an empty API
 * balance or a rate limit is visible in the chat instead of a vague "something went wrong". */
function describeChatError(err: unknown): string {
  const e = err as { status?: number; message?: string };
  const detail = (e.message ?? "").replace(/\s+/g, " ").slice(0, 160);
  let reason = "onbekende fout";
  if (e.status === 401 || e.status === 403) {
    // Only the first characters and the length — enough to tell an old, truncated or
    // wrongly pasted key apart from the right one, without exposing the secret.
    const k = env.anthropicApiKey;
    reason = `de Anthropic API-key werkt niet — de server gebruikt een key die begint met "${k.slice(0, 10)}…" en ${k.length} tekens lang is`;
  }
  else if (e.status === 402 || /credit balance/i.test(detail)) reason = "het Anthropic-tegoed is op";
  else if (e.status === 429) reason = "te veel verzoeken achter elkaar, even wachten";
  else if (e.status === 404) reason = "het ingestelde AI-model bestaat niet";
  else if (e.status === 413 || /too large|too long/i.test(detail)) reason = "het bericht of de foto is te groot";
  else if (e.status === 529 || (e.status && e.status >= 500)) reason = "Claude is tijdelijk overbelast";
  else if (e.status === 400) reason = "de aanvraag werd afgewezen";
  return `Er ging iets mis bij het verwerken van je bericht (${reason}). Probeer het nog eens.${detail ? `\n\nTechnisch: ${detail}` : ""}`;
}

function todayLine(): string {
  const now = new Date();
  const weekday = now.toLocaleDateString("nl-NL", { weekday: "long", timeZone: "Europe/Amsterdam" });
  return `Vandaag is het ${weekday} ${amsterdamDayKey(now)} (Nederlandse tijd). Gebruik dit voor datums als "morgen" of "volgende week maandag".\n\n`;
}

const chatSchema = z.object({
  message: z.string().min(1),
  images: z
    .array(z.string().startsWith("data:image/").max(3_000_000))
    .max(4)
    .optional(),
  imageKind: z.enum(["screenshot", "progress"]).optional(),
});

/** One-line note appended to older messages so the coach knows an image was part of them,
 * without resending the image data every turn. */
function imageNote(images: string | null, kind: string | null): string {
  const n = parseImages(images).length;
  if (!n) return "";
  return kind === "progress"
    ? ` [${n} voortgangsfoto('s) geüpload en opgeslagen]`
    : ` [${n} screenshot(s) meegestuurd, nu niet meer zichtbaar]`;
}

/** Replies that mean "the coach didn't answer" — these can be retried instead of re-typed. */
export const isErrorReply = (content: string) => content.startsWith("Er ging iets mis") || content.startsWith("Sorry, mijn antwoord");

type TriggerMessage = { content: string; images: string[]; kind?: "screenshot" | "progress" };

/** Runs the coach for one user message and stores the reply (or a readable error). The HTTP
 * request has long since returned by now, so this must never throw. */
async function generateReply(userId: string, trigger: TriggerMessage, history: { role: string; content: string; images: string | null; imageKind: string | null }[]) {
  try {
    const context = await buildUserContext(userId);
    const { finalText } = await callClaudeWithTools({
      system: todayLine() + COACH_SYSTEM_PROMPT + context,
      messages: [
        ...history
          .filter((m) => m.content.trim().length > 0) // legacy empty replies make the API reject the call
          .map((m) => ({
            role: m.role as "user" | "assistant",
            content: m.content + imageNote(m.images, m.imageKind),
          })),
        {
          role: "user" as const,
          content:
            trigger.kind === "screenshot"
              ? `${trigger.content}\n\n[De gebruiker stuurt ${trigger.images.length} screenshot(s)/afbeelding(en) mee — geen voortgangsfoto's. Bekijk en bespreek wat erop staat.]`
              : trigger.kind === "progress"
                ? `${trigger.content}\n\n[De gebruiker heeft ${trigger.images.length} voortgangsfoto('s) van zijn lichaam geüpload en opgeslagen — beoordeel die met analyze_physique_photo.]`
                : trigger.content,
          images: trigger.kind === "screenshot" ? trigger.images : undefined,
        },
      ],
      tools: buildCoachTools(userId),
      maxTokens: 2048,
      maxIterations: 10,
    });
    await prisma.chatMessage.create({ data: { userId, role: "assistant", content: finalText } });
  } catch (err) {
    console.error("Chat AI call failed", err);
    await prisma.chatMessage
      .create({ data: { userId, role: "assistant", content: describeChatError(err) } })
      .catch((e) => console.error("Could not store chat error reply", e));
  }
}

chatRouter.post("/", async (req: AuthedRequest, res) => {
  const parsed = chatSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  const userId = req.userId!;
  const history = (await prisma.chatMessage.findMany({ where: { userId }, orderBy: { createdAt: "desc" }, take: 20 })).reverse();

  const images = parsed.data.images ?? [];
  const kind = images.length ? (parsed.data.imageKind ?? "screenshot") : undefined;
  if (kind === "progress") {
    // Only these go into the progress-photo gallery; screenshots are conversation
    // material for the coach and must not end up in the body-photo collection.
    for (const imageData of images) {
      await prisma.progressPhoto.create({ data: { userId, imageData } });
    }
  }
  await prisma.chatMessage.create({
    data: {
      userId,
      role: "user",
      content: parsed.data.message,
      images: images.length ? JSON.stringify(images) : null,
      imageKind: kind ?? null,
    },
  });

  // Respond immediately and keep working after — a multi-turn tool-use reply can take a
  // while, and tying it to the open HTTP request means it dies the moment a mobile browser
  // backgrounds the tab or the user navigates away. The client polls GET /ai/chat instead,
  // so the reply lands (and any program/goal changes get made) even if nobody's watching.
  res.status(202).json({ pending: true });
  await generateReply(userId, { content: parsed.data.message, images, kind }, history);
});

/** Re-runs the coach for the last user message after a failed or lost reply (an error
 * reply, or a restart that dropped the answer), without the user having to retype it. */
chatRouter.post("/retry", async (req: AuthedRequest, res) => {
  const userId = req.userId!;
  const recent = await prisma.chatMessage.findMany({ where: { userId }, orderBy: { createdAt: "desc" }, take: 22 });
  const errorIds: string[] = [];
  let i = 0;
  while (i < recent.length && recent[i].role === "assistant" && isErrorReply(recent[i].content)) errorIds.push(recent[i++].id);
  const last = recent[i];
  if (!last || last.role !== "user") return res.status(400).json({ error: "Er is niets om opnieuw te proberen." });

  if (errorIds.length) await prisma.chatMessage.deleteMany({ where: { id: { in: errorIds } } });
  const history = recent.slice(i + 1, i + 21).reverse();
  const images = (() => {
    try {
      const v = JSON.parse(last.images ?? "[]");
      return Array.isArray(v) ? (v as string[]) : [];
    } catch {
      return [];
    }
  })();
  res.status(202).json({ pending: true });
  await generateReply(userId, { content: last.content, images, kind: images.length ? ((last.imageKind as "screenshot" | "progress" | null) ?? "screenshot") : undefined }, history);
});

/** At startup nothing can be mid-reply, so a conversation whose last message is the user's
 * was cut off by a restart/deploy — leave a retryable note instead of a forever-spinner. */
export async function recoverStuckChats() {
  const latest = await prisma.chatMessage.findMany({ orderBy: { createdAt: "desc" }, distinct: ["userId"], take: 20 });
  for (const m of latest) {
    if (m.role === "user") {
      await prisma.chatMessage.create({
        data: { userId: m.userId, role: "assistant", content: "Sorry, mijn antwoord ging verloren doordat de server herstartte. Tik op 'Opnieuw proberen'." },
      });
    }
  }
}
