import { ENV } from "./env";

/**
 * The portal's public address, used in every link sent to clients.
 * - APP_URL with an address: that address, always.
 * - APP_URL=auto (or empty): asks the running cloudflared for the quick tunnel's current address,
 *   so the links follow the tunnel when it restarts with a new one. Without a tunnel, falls back
 *   to the address the request came in on.
 */

let cached: { url: string | null; at: number } = { url: null, at: 0 };
const CACHE_MS = 30_000;

async function tunnelUrl(): Promise<string | null> {
  if (Date.now() - cached.at < CACHE_MS) return cached.url;
  let url: string | null = null;
  try {
    const response = await fetch(`http://${ENV.cloudflaredMetrics}/quicktunnel`, { signal: AbortSignal.timeout(1500) });
    if (response.ok) {
      const body = (await response.json()) as { hostname?: string };
      if (body.hostname) url = `https://${body.hostname}`;
    }
  } catch {
    // cloudflared not running (or not on that port): no tunnel address.
  }
  cached = { url, at: Date.now() };
  return url;
}

type RequestLike = { headers: Record<string, unknown>; protocol?: string; get?: (name: string) => string | undefined };

export async function getPublicUrl(req?: RequestLike): Promise<string> {
  const configured = ENV.appUrl.trim();
  if (configured && configured.toLowerCase() !== "auto") return configured.replace(/\/$/, "");
  const tunnel = await tunnelUrl();
  if (tunnel) return tunnel;
  if (req?.get) {
    const proto = String(req.headers["x-forwarded-proto"] ?? req.protocol ?? "http").split(",")[0].trim();
    const host = req.get("host");
    if (host) return `${proto}://${host}`;
  }
  return `http://localhost:${process.env.PORT || 3000}`;
}
