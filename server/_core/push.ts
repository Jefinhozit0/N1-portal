import fs from "node:fs";
import path from "node:path";
import webpush from "web-push";
import { ENV } from "./env";
import { supabase } from "./supabase";

/**
 * Notifications of the installed app (Web Push). The browser of each device the client turned the
 * notices on gives an address at its push service (Google, Apple, Mozilla, Microsoft); the server
 * sends to it and the service worker shows the notice, even with the app closed.
 *
 * The VAPID key pair identifies this server to those services. It must never change, or every
 * device has to turn the notices on again: set VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY in .env, or
 * leave them out and a pair is created once and kept in .push-keys.json (keep it in the backup).
 */

const MIGRATION_PUSH = "Rode o arquivo supabase/migrations/20261016_notificacoes_app.sql no SQL Editor do Supabase.";
const KEYS_FILE = path.resolve(process.cwd(), ".push-keys.json");

type Keys = { publicKey: string; privateKey: string };
let keys: Keys | null = null;

function loadKeys(): Keys {
  if (keys) return keys;
  if (ENV.vapidPublicKey && ENV.vapidPrivateKey) {
    keys = { publicKey: ENV.vapidPublicKey, privateKey: ENV.vapidPrivateKey };
  } else {
    try {
      keys = JSON.parse(fs.readFileSync(KEYS_FILE, "utf8")) as Keys;
    } catch {
      keys = webpush.generateVAPIDKeys();
      fs.writeFileSync(KEYS_FILE, JSON.stringify(keys, null, 2));
      console.log(`[push] Created the notification keys in ${KEYS_FILE}. Keep this file: losing it turns off the notices on every device.`);
    }
  }
  // Apple only accepts a mailto: or https: contact here.
  const contact = ENV.gmailUser || ENV.adminEmails[0] || ENV.staffEmails[0];
  webpush.setVapidDetails(contact ? `mailto:${contact}` : ENV.appUrl, keys.publicKey, keys.privateKey);
  return keys;
}

/** The key the browser needs to subscribe (applicationServerKey). */
export function getPushPublicKey() {
  return loadKeys().publicKey;
}

/** True when the error means the table of the migration above does not exist yet. */
export const isMissingPushTable = (error: { code?: string; message?: string }) =>
  error.code === "42P01" || error.code === "PGRST205" || /does not exist|schema cache/i.test(error.message ?? "");

export type PushSubscriptionInput = { endpoint: string; keys: { p256dh: string; auth: string } };

/** Saves (or moves to this client) the device that just turned the notices on. */
export async function savePushSubscription(clientId: number, subscription: PushSubscriptionInput, userAgent: string, installed: boolean) {
  const { error } = await supabase.from("push_inscricoes").upsert(
    {
      client_id: clientId,
      endpoint: subscription.endpoint,
      p256dh: subscription.keys.p256dh,
      auth: subscription.keys.auth,
      user_agent: userAgent.slice(0, 300),
      instalado: installed,
    },
    { onConflict: "endpoint" },
  );
  if (error) throw new Error(isMissingPushTable(error) ? `O banco ainda não tem a tabela de notificações. ${MIGRATION_PUSH}` : error.message);
}

/** Devices with the notices on, per client, for the Termos report. Empty when the table is missing. */
export async function listPushDevices(): Promise<Map<number, { devices: number; installed: boolean }>> {
  const byClient = new Map<number, { devices: number; installed: boolean }>();
  const { data, error } = await supabase.from("push_inscricoes").select("client_id, instalado").limit(20000);
  if (error) {
    if (!isMissingPushTable(error)) console.warn("[push] Could not list devices:", error.message);
    return byClient;
  }
  for (const row of data ?? []) {
    const id = Number(row.client_id);
    const current = byClient.get(id) ?? { devices: 0, installed: false };
    byClient.set(id, { devices: current.devices + 1, installed: current.installed || row.instalado === true });
  }
  return byClient;
}

/** What the service worker shows (see client/public/sw.js). `url` (relative) opens when the notice is tapped. */
export type PushMessage = { title: string; body: string; url: string; tag: string };

/** Sends to every device of the client. Devices the service says are gone are removed. */
export async function sendPushToClient(clientId: number, message: PushMessage) {
  const { data, error } = await supabase.from("push_inscricoes").select("id, endpoint, p256dh, auth").eq("client_id", clientId);
  if (error) {
    if (!isMissingPushTable(error)) console.warn(`[push] Could not read the devices of client #${clientId}:`, error.message);
    return 0;
  }
  if (!data?.length) return 0;
  loadKeys();
  const payload = JSON.stringify(message);
  let delivered = 0;
  await Promise.all(data.map(async (row) => {
    try {
      // TTL: a phone that is off still gets the notice if it comes back within a day.
      await webpush.sendNotification({ endpoint: row.endpoint, keys: { p256dh: row.p256dh, auth: row.auth } }, payload, { TTL: 86_400, urgency: "high" });
      delivered++;
      await supabase.from("push_inscricoes").update({ ultimo_envio_em: new Date().toISOString() }).eq("id", row.id);
    } catch (sendError) {
      const status = (sendError as { statusCode?: number }).statusCode;
      // 404/410: the app was uninstalled or the notices were blocked on that device.
      if (status === 404 || status === 410) {
        await supabase.from("push_inscricoes").delete().eq("id", row.id);
      } else {
        console.warn(`[push] Notice to client #${clientId} failed:`, sendError instanceof Error ? sendError.message : sendError);
      }
    }
  }));
  return delivered;
}
