// Service worker of the N1 portal. Its only job: when the server cannot be reached (the notebook
// that runs it is off or asleep), show the "em manutenção" page instead of the browser's error.
// It never caches the portal itself, so a new deploy is always picked up.

const CACHE = "n1-manutencao-v1";
const OFFLINE_PAGE = "/manutencao.html";
const LOGO = "/n1-logo.png";
// Funnel may hold the connection open for a long time while the notebook sleeps.
const TIMEOUT_MS = 10000;

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll([OFFLINE_PAGE, LOGO])).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== CACHE).map((key) => caches.delete(key))))
      .then(() => self.clients.claim()),
  );
});

async function offlinePage() {
  const cached = await caches.match(OFFLINE_PAGE);
  return cached || new Response("Portal em manutenção. Tente novamente em alguns minutos.", { status: 503, headers: { "Content-Type": "text/plain; charset=utf-8" } });
}

async function navigate(request) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const response = await fetch(request, { signal: controller.signal });
    // Bad gateway / unavailable / timeout from the tunnel: the server behind it is not answering.
    if (response.status >= 502 && response.status <= 504) return offlinePage();
    return response;
  } catch {
    return offlinePage();
  } finally {
    clearTimeout(timer);
  }
}

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;
  if (request.mode === "navigate") {
    event.respondWith(navigate(request));
    return;
  }
  // The maintenance page shows the logo even with the server off.
  const url = new URL(request.url);
  if (url.origin === self.location.origin && url.pathname === LOGO) {
    event.respondWith(fetch(request).catch(() => caches.match(LOGO)));
  }
});
