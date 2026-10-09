import type { Express } from "express";
import { findFirstAccessUserByToken } from "./clientAccess";

/**
 * Short first-access link: /a/K7p2XqM4bN9w opens the page where the client creates the password.
 * Opening it does not use the link up; only saving the password does. A link that expired or was
 * already used goes to the same page, which then says so.
 */

const WINDOW_MS = 60_000;
const MAX_HITS_PER_WINDOW = 20;
const hits = new Map<string, { count: number; since: number }>();

function tooManyHits(ip: string) {
  const now = Date.now();
  const entry = hits.get(ip);
  if (!entry || now - entry.since > WINDOW_MS) {
    hits.set(ip, { count: 1, since: now });
    // Keeps the map small: drop windows that are already over.
    if (hits.size > 5_000) hits.forEach((value, key) => { if (now - value.since > WINDOW_MS) hits.delete(key); });
    return false;
  }
  entry.count += 1;
  return entry.count > MAX_HITS_PER_WINDOW;
}

export function registerShortLinks(app: Express) {
  app.get("/a/:token", async (req, res) => {
    // The link carries a secret: never cache it or pass it on to other sites.
    res.set("Cache-Control", "no-store");
    res.set("Referrer-Policy", "no-referrer");
    if (tooManyHits(req.ip || "unknown")) {
      res.status(429).type("text/plain; charset=utf-8").send("Muitas tentativas. Aguarde um minuto e abra o link de novo.");
      return;
    }
    try {
      const user = await findFirstAccessUserByToken(req.params.token);
      res.redirect(302, user ? `/primeiro-acesso?u=${user.id}&t=${req.params.token}` : "/primeiro-acesso");
    } catch (error) {
      console.error("[shortLinks] Lookup failed:", error);
      res.redirect(302, "/primeiro-acesso");
    }
  });
}
