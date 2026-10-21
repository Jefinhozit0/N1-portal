import type { User } from "@supabase/supabase-js";
import { listAllUsers } from "./dashboard";
import { supabase } from "./supabase";

/** Free plan limits. Change them here if the plan changes. */
export const PLAN_LIMITS = {
  bancoBytes: 500 * 1024 * 1024,
  arquivosBytes: 1024 * 1024 * 1024,
  usuariosAtivosMes: 50_000,
} as const;

/** From this share of a limit on, the panel warns. */
export const WARN_AT = 0.8;

const DAY = 86_400_000;
const TABLES = ["clientes", "chargebacks", "vendas", "mensagens", "documentos", "cliente_eventos", "consultores", "auditoria"] as const;
/** Rough size of one row with its indexes, used only while the exact size function does not exist. */
const ESTIMATED_ROW_BYTES = 1024;
/** An empty Supabase database already takes about this much (system tables and extensions). */
const EMPTY_DATABASE_BYTES = 25 * 1024 * 1024;

type Gauge = { usado: number; limite: number; percent: number; alerta: boolean; mesesAteOLimite: number | null };

/** Months until the limit at the pace of the last 30 days; null when it is not growing. */
export function monthsUntilLimit(used: number, limit: number, growthLast30Days: number): number | null {
  if (growthLast30Days <= 0) return null;
  return Math.max(0, (limit - used) / growthLast30Days);
}

export function gauge(used: number, limit: number, growthLast30Days: number): Gauge {
  const percent = limit ? used / limit : 0;
  return { usado: used, limite: limit, percent, alerta: percent >= WARN_AT, mesesAteOLimite: monthsUntilLimit(used, limit, growthLast30Days) };
}

async function countRows(table: string, since?: string) {
  let query = supabase.from(table).select("*", { count: "exact", head: true });
  if (since) query = query.gte("created_at", since);
  const { count, error } = await query;
  return error ? 0 : count ?? 0;
}

export async function computeSupabaseUsage(now = Date.now()) {
  const since = new Date(now - 30 * DAY).toISOString();
  const [sizeRes, docsRes, clientesRes, users, counts, recentCounts] = await Promise.all([
    supabase.rpc("tamanho_banco"),
    supabase.from("documentos").select("client_id, tamanho, created_at").limit(100_000),
    supabase.from("clientes").select("id, name").limit(10_000),
    listAllUsers().catch(() => [] as User[]),
    Promise.all(TABLES.map((table) => countRows(table))),
    Promise.all(TABLES.map((table) => countRows(table, since))),
  ]);

  // ── Database ─────────────────────────────────────────────
  const rows = counts.reduce((sum, n) => sum + n, 0);
  const rowsLast30 = recentCounts.reduce((sum, n) => sum + n, 0);
  const exact = !sizeRes.error && typeof sizeRes.data === "number";
  const databaseBytes = exact ? (sizeRes.data as number) : EMPTY_DATABASE_BYTES + rows * ESTIMATED_ROW_BYTES;

  // ── Files (documents attached to clients) ────────────────
  const docs = (docsRes.data ?? []) as { client_id: number; tamanho: number | null; created_at: string }[];
  const fileBytes = docs.reduce((sum, doc) => sum + (doc.tamanho ?? 0), 0);
  const fileBytesLast30 = docs.filter((doc) => doc.created_at >= since).reduce((sum, doc) => sum + (doc.tamanho ?? 0), 0);
  const names = new Map(((clientesRes.data ?? []) as { id: number; name: string }[]).map((c) => [c.id, c.name]));
  const byClient = new Map<number, { bytes: number; arquivos: number }>();
  for (const doc of docs) {
    const entry = byClient.get(doc.client_id) ?? { bytes: 0, arquivos: 0 };
    entry.bytes += doc.tamanho ?? 0;
    entry.arquivos++;
    byClient.set(doc.client_id, entry);
  }
  const maioresClientes = Array.from(byClient, ([id, entry]) => ({ id, nome: names.get(id) ?? `Cliente #${id}`, ...entry }))
    .sort((a, b) => b.bytes - a.bytes)
    .slice(0, 5);

  // ── Logins active in the last 30 days (what Supabase counts as monthly active users) ──
  const activeUsers = users.filter((user) => (Date.parse(user.last_sign_in_at ?? "") || 0) >= now - 30 * DAY).length;

  const gauges = {
    // Growth is estimated from new rows either way: the exact size has no history to compare with.
    banco: gauge(databaseBytes, PLAN_LIMITS.bancoBytes, rowsLast30 * ESTIMATED_ROW_BYTES),
    arquivos: gauge(fileBytes, PLAN_LIMITS.arquivosBytes, fileBytesLast30),
    usuarios: gauge(activeUsers, PLAN_LIMITS.usuariosAtivosMes, 0),
  };

  return {
    avisarEm: WARN_AT,
    tamanhoExato: exact,
    ...gauges,
    detalhes: {
      linhas: rows,
      linhasUltimos30Dias: rowsLast30,
      porTabela: Object.fromEntries(TABLES.map((table, index) => [table, counts[index]])),
      documentos: docs.length,
      bytesUltimos30Dias: fileBytesLast30,
      logins: users.length,
      maioresClientes,
    },
    alerta: Object.values(gauges).some((item) => item.alerta),
    geradoEm: new Date(now).toISOString(),
  };
}

export type SupabaseUsage = Awaited<ReturnType<typeof computeSupabaseUsage>>;
