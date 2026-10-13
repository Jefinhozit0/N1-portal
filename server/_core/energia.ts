import { readFile } from "node:fs/promises";
import path from "node:path";
import { notifyTeam } from "./notificacoes";

/**
 * Whether the notebook that runs the portal is plugged in. scripts/iniciar-portal.ps1 writes
 * logs/energia.json every 15 seconds; on battery Windows soon puts the notebook to sleep and the
 * portal goes offline, so the team is warned in the portal and by e-mail/WhatsApp.
 */

export type PowerState = { naTomada: boolean; bateria: number | null; minutosRestantes: number | null; desde: string | null };

const STATE_FILE = path.resolve("logs", "energia.json");
/** Older than this, the file is from a watchdog that is not running (or another machine): ignore it. */
const STALE_MS = 90_000;
/** A quick unplug (moving the cable) does not send a notice. */
const NOTIFY_AFTER_MS = 60_000;
const CHECK_EVERY_MS = 30_000;

let onBatterySince: number | null = null;
let noticeSent = false;

export function parsePowerFile(content: string, now = Date.now()): Omit<PowerState, "desde"> | null {
  try {
    const data = JSON.parse(content.replace(/^﻿/, "")) as { naTomada?: unknown; bateria?: unknown; minutosRestantes?: unknown; em?: unknown };
    const at = typeof data.em === "string" ? Date.parse(data.em) : NaN;
    if (Number.isNaN(at) || now - at > STALE_MS || typeof data.naTomada !== "boolean") return null;
    return {
      naTomada: data.naTomada,
      bateria: typeof data.bateria === "number" ? data.bateria : null,
      minutosRestantes: typeof data.minutosRestantes === "number" ? data.minutosRestantes : null,
    };
  } catch {
    return null;
  }
}

/** Null when unknown (not running on the notebook, or the watchdog is not running). */
export async function getPowerState(now = Date.now()): Promise<PowerState | null> {
  const content = await readFile(STATE_FILE, "utf8").catch(() => null);
  const state = content ? parsePowerFile(content, now) : null;
  if (!state) return null;
  return { ...state, desde: !state.naTomada && onBatterySince ? new Date(onBatterySince).toISOString() : null };
}

async function check() {
  const now = Date.now();
  const state = await getPowerState(now);
  if (!state) return;
  if (state.naTomada) {
    if (noticeSent) {
      notifyTeam(
        "O notebook do portal voltou para a tomada",
        ["O carregador foi ligado de novo e o portal segue no ar normalmente."],
        "✅ *O notebook do portal N1 voltou para a tomada.* O portal segue no ar normalmente.",
      );
    }
    onBatterySince = null;
    noticeSent = false;
    return;
  }
  onBatterySince ??= now;
  if (!noticeSent && now - onBatterySince >= NOTIFY_AFTER_MS) {
    noticeSent = true;
    const battery = [state.bateria !== null && `bateria em ${state.bateria}%`, state.minutosRestantes && `cerca de ${state.minutosRestantes} minutos restantes`].filter(Boolean).join(", ");
    notifyTeam(
      "O notebook do portal saiu da tomada",
      [`O notebook que mantém o portal no ar está na bateria${battery ? ` (${battery})` : ""}.`, "Ligue o carregador de volta: sem ele o notebook dorme e o portal sai do ar para a equipe e para os clientes."],
      `⚠️ *O notebook do portal N1 saiu da tomada*${battery ? ` (${battery})` : ""}.\n\nLigue o carregador de volta: sem ele o portal sai do ar.`,
    );
  }
}

export function startPowerWatch() {
  if (process.platform !== "win32") return;
  setInterval(() => void check().catch((error) => console.warn("[energia] Check failed:", error)), CHECK_EVERY_MS);
}
