/**
 * App notifications on this device (Web Push). The browser gives a subscription that the server
 * keeps (cliente.ativarNotificacoes) and sends to; sw.js shows the notice.
 * On iPhone/iPad this only exists inside the installed app (opened from the home screen, iOS 16.4+).
 */

export type PushState = "unsupported" | "denied" | "off" | "on";

export type SubscriptionPayload = { endpoint: string; keys: { p256dh: string; auth: string } };

export function pushSupported() {
  return typeof window !== "undefined" && "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
}

/** The server's key, in base64url, as the bytes PushManager.subscribe wants. */
export function keyToBytes(base64url: string) {
  const base64 = (base64url + "=".repeat((4 - (base64url.length % 4)) % 4)).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64);
  return Uint8Array.from(raw, (char) => char.charCodeAt(0));
}

const sameKey = (a: ArrayBuffer | null | undefined, b: Uint8Array) =>
  !!a && a.byteLength === b.byteLength && new Uint8Array(a).every((byte, index) => byte === b[index]);

/** The service worker is only registered in production (main.tsx); here it also comes up on demand. */
async function registration() {
  return (await navigator.serviceWorker.getRegistration()) ?? (await navigator.serviceWorker.register("/sw.js"));
}

function toPayload(subscription: PushSubscription): SubscriptionPayload | null {
  const json = subscription.toJSON();
  return json.endpoint && json.keys?.p256dh && json.keys?.auth ? { endpoint: json.endpoint, keys: { p256dh: json.keys.p256dh, auth: json.keys.auth } } : null;
}

export async function currentPushState(): Promise<PushState> {
  if (!pushSupported()) return "unsupported";
  if (Notification.permission === "denied") return "denied";
  if (Notification.permission !== "granted") return "off";
  const existing = await (await navigator.serviceWorker.getRegistration())?.pushManager.getSubscription();
  return existing ? "on" : "off";
}

/**
 * Asks for permission (call it from a tap: Safari and Firefox require it) and subscribes this device.
 * A subscription made with another server key (keys were replaced) is swapped for a new one.
 * Returns null when the client did not allow the notices.
 */
export async function subscribeToPush(publicKey: string): Promise<SubscriptionPayload | null> {
  if (!pushSupported()) return null;
  const permission = Notification.permission === "granted" ? "granted" : await Notification.requestPermission();
  if (permission !== "granted") return null;
  const key = keyToBytes(publicKey);
  const reg = await registration();
  await navigator.serviceWorker.ready;
  let subscription = await reg.pushManager.getSubscription();
  if (subscription && !sameKey(subscription.options.applicationServerKey, key)) {
    await subscription.unsubscribe();
    subscription = null;
  }
  subscription ??= await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: key });
  return toPayload(subscription);
}

