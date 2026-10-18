import { prisma } from "./db.js";

const DAY_MS = 86_400_000;

/** Chat attachments are only needed while the conversation is fresh; keeping every base64
 * screenshot forever would eat the small free database. Progress photos live in their own
 * table and are untouched. */
export async function purgeOldChatImages(days = 7) {
  const r = await prisma.chatMessage.updateMany({
    where: { images: { not: null }, createdAt: { lt: new Date(Date.now() - days * DAY_MS) } },
    data: { images: null },
  });
  if (r.count > 0) console.log(`Purged images from ${r.count} old chat messages`);
}

export function startMaintenance() {
  const run = () => purgeOldChatImages().catch((e) => console.error("Chat image purge failed", e));
  run();
  setInterval(run, 12 * 60 * 60 * 1000).unref();
}
