import { readFile } from "node:fs/promises";
import path from "node:path";
import { notifyTeam } from "./notificacoes";

/**
 * Whether the notebook that runs the portal is plugged in. scripts/iniciar-portal.ps1 writes
 * logs/energia.json every 15 seconds; on battery Windows soon puts the notebook to sleep and the
 * portal goes offline, so the team is warned in the portal and by e-mail/WhatsApp.
 */

export type PowerState = { naTomada: boolean; bateria: number | null; minutosRestantes: number | null; desde: string | null };

/** POWER_STATE_FILE="" turns the check off (the tests do, so they never depend on this machine's battery). */
const STATE_FILE = process.env.POWER_STATE_FILE ?? path.resolve("logs", "energia.json");
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
  const content = STATE_FILE ? await readFile(STATE_FILE, "utf8").catch(() => null) : null;
  const state = content ? parsePowerFile(content, now) : null;
  if (!state) return null;
  return { ...state, desde: !state.naTomada && onBatterySince ? new Date(onBatterySince).toISOString() : null };
}

/**
 * Clients see "em manutenção" while the notebook is on battery (it is about to sleep and take the
 * portal down) or while MANUTENCAO=on is set in .env. The team keeps working, with a warning.
 */
export async function isUnderMaintenance(): Promise<boolean> {
  if ((process.env.MANUTENCAO ?? "").toLowerCase() === "on") return true;
  const state = await getPowerState();
  return state !== null && !state.naTomada;
}

export const MAINTENANCE_MESSAGE = "MANUTENCAO";

async function check() {
  const now = Date.now();
  const state = await getPowerState(now);
  if (!state) return;
  if (state.naTomada) {
    if (noticeSent) {
      notifyTeam(
        "O notebook do portal voltou para a tomada",
        ["O carregador foi ligado de novo. O portal segue no ar e os clientes já voltaram a usar normalmente."],
        "✅ *O notebook do portal N1 voltou para a tomada.* Os clientes já voltaram a usar o portal normalmente.",
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
      [`O notebook que mantém o portal no ar está na bateria${battery ? ` (${battery})` : ""}.`, "Enquanto isso, os clientes veem a tela \"Em manutenção\". Ligue o carregador de volta: sem ele o notebook dorme e o portal sai do ar para todos."],
      `⚠️ *O notebook do portal N1 saiu da tomada*${battery ? ` (${battery})` : ""}.\n\nOs clientes estão vendo a tela "Em manutenção". Ligue o carregador de volta: sem ele o portal sai do ar.`,
    );
  }
}

export function startPowerWatch() {
  if (process.platform !== "win32") return;
  setInterval(() => void check().catch((error) => console.warn("[energia] Check failed:", error)), CHECK_EVERY_MS);
}
