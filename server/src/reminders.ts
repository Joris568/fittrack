import { prisma } from "./db.js";
import { addDaysKey, dayKeyOf, dayRange } from "./lib/tz.js";
import { isDue, localMinutes } from "./lib/reminderTiming.js";
import { sendToUser } from "./lib/pushKeys.js";

function readLog(raw: string | null): Set<string> {
  try {
    const v = JSON.parse(raw ?? "[]");
    return new Set(Array.isArray(v) ? v.filter((x) => typeof x === "string") : []);
  } catch {
    return new Set();
  }
}

/** One pass over everyone with notifications on: decides which reminders are due right now and
 * only bothers the user when there is actually something to remind about. Safe to call often. */
export async function runReminderTick(now = new Date(), send: typeof sendToUser = sendToUser) {
  const all = await prisma.reminderSettings.findMany({
    include: { user: { select: { id: true, tzOffsetMin: true, profile: { select: { goal: true } }, _count: { select: { pushSubscriptions: true } } } } },
  });

  for (const s of all) {
    if (s.user._count.pushSubscriptions === 0) continue;
    const userId = s.user.id;
    const tz = s.user.tzOffsetMin;
    const nowMin = localMinutes(now, tz);
    const today = dayKeyOf(now, tz);
    const sent = readLog(s.sentLog);
    const has = (type: string) => sent.has(`${type}:${today}`);
    const mark = (type: string) => sent.add(`${type}:${today}`);
    const weekday = new Date(now.getTime() - tz * 60_000).getUTCDay(); // 0 = Sunday
    const { start, end } = dayRange(today, tz);

    if (s.trainingOn && isDue(nowMin, s.trainingTime, has("training"))) {
      mark("training");
      const [plans, sessions] = await Promise.all([
        prisma.plannedWorkout.findMany({ where: { userId, date: today, done: false }, include: { programDay: { select: { name: true } } } }),
        prisma.workoutSession.findMany({ where: { userId, date: { gte: start, lt: end } }, select: { programDayId: true } }),
      ]);
      const open = plans.filter((p) => !(p.programDayId && sessions.some((x) => x.programDayId === p.programDayId)) && !p.sessionId);
      if (open.length > 0) {
        await send(userId, {
          title: "Tijd om te trainen",
          body: `Vandaag staat ${open.map((p) => p.programDay?.name ?? p.title ?? "training").join(" en ")} gepland.`,
          url: "/",
          tag: "training",
        });
      }
    }

    if (s.weighOn && isDue(nowMin, s.weighTime, has("weigh"))) {
      mark("weigh");
      const since = dayRange(addDaysKey(today, -2), tz).start;
      const recent = await prisma.bodyMetric.count({ where: { userId, date: { gte: since } } });
      if (recent === 0) {
        await send(userId, { title: "Even wegen", body: "Je hebt de afgelopen dagen niet gewogen. Een paar keer per week is genoeg voor een goede trend.", url: "/settings", tag: "weigh" });
      }
    }

    if (s.foodOn && isDue(nowMin, s.foodTime, has("food"))) {
      mark("food");
      const entries = await prisma.foodLogEntry.findMany({
        where: { userId, date: { gte: start, lt: end } },
        select: { quantityGrams: true, foodItem: { select: { caloriesPer100g: true } } },
      });
      const kcal = entries.reduce((n, e) => n + (e.foodItem.caloriesPer100g * e.quantityGrams) / 100, 0);
      if (kcal < 800) {
        await send(userId, { title: "Eten loggen", body: "Je hebt vandaag nog weinig gelogd. Vul het aan, dan klopt je weekcheck.", url: "/eat", tag: "food" });
      }
    }

    if (s.weeklyOn && isDue(nowMin, "09:00", has("weekly")) && weekday === 1 && s.user.profile?.goal) {
      mark("weekly");
      await send(userId, { title: "Je weekcheck staat klaar", body: "Kijk of je calorieën nog kloppen met je gewichtstrend.", url: "/", tag: "weekly" });
    }
    if (s.weeklyOn && isDue(nowMin, "10:00", has("recap")) && today.endsWith("-01")) {
      mark("recap");
      await send(userId, { title: "Je maandoverzicht staat klaar", body: "Bekijk wat je vorige maand hebt getild en je beste records.", url: "/recap", tag: "recap" });
    }

    // keep the log small: only today's keys matter
    const kept = [...sent].filter((k) => k.endsWith(`:${today}`));
    await prisma.reminderSettings.update({ where: { id: s.id }, data: { sentLog: JSON.stringify(kept) } });
  }
}

export function startReminders() {
  const tick = () => runReminderTick().catch((e) => console.error("Reminder tick failed", e));
  setTimeout(tick, 20_000).unref();
  setInterval(tick, 60_000).unref();
}
