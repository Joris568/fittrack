import webpush from "web-push";
import { prisma } from "../db.js";
import { env } from "../env.js";

let cached: { publicKey: string; privateKey: string } | null = null;

/** VAPID keys identify this server to the browsers' push services. They are generated once
 * and kept in the database, so deploying never needs extra environment setup. */
export async function getVapidKeys() {
  if (cached) return cached;
  const rows = await prisma.appSecret.findMany({ where: { key: { in: ["vapid_public", "vapid_private"] } } });
  const pub = rows.find((r) => r.key === "vapid_public")?.value;
  const priv = rows.find((r) => r.key === "vapid_private")?.value;
  if (pub && priv) {
    cached = { publicKey: pub, privateKey: priv };
  } else {
    const keys = webpush.generateVAPIDKeys();
    await prisma.appSecret.upsert({ where: { key: "vapid_public" }, update: { value: keys.publicKey }, create: { key: "vapid_public", value: keys.publicKey } });
    await prisma.appSecret.upsert({ where: { key: "vapid_private" }, update: { value: keys.privateKey }, create: { key: "vapid_private", value: keys.privateKey } });
    cached = keys;
  }
  // Push services want a contact address in the signed token; the account email is the natural one.
  webpush.setVapidDetails(process.env.VAPID_SUBJECT ?? `mailto:${env.userEmail}`, cached.publicKey, cached.privateKey);
  return cached;
}

export interface PushPayload {
  title: string;
  body: string;
  url?: string;
  tag?: string;
}

/** Sends one notification to every device of a user; subscriptions the push service reports as
 * gone (404/410) are deleted. Returns how many devices accepted it. */
export async function sendToUser(userId: string, payload: PushPayload): Promise<number> {
  await getVapidKeys();
  const subs = await prisma.pushSubscription.findMany({ where: { userId } });
  let ok = 0;
  for (const sub of subs) {
    try {
      await webpush.sendNotification({ endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } }, JSON.stringify(payload), { TTL: 3600 });
      ok++;
    } catch (err) {
      const status = (err as { statusCode?: number }).statusCode;
      if (status === 404 || status === 410) await prisma.pushSubscription.delete({ where: { id: sub.id } }).catch(() => {});
      else console.error("Push send failed", status ?? err);
    }
  }
  return ok;
}
