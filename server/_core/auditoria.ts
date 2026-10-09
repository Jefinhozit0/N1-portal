import { supabase } from "./supabase";

/**
 * Action log: who on the team did what, and when. Shown to administrators in the portal.
 * Writing it never blocks the action itself; before the migration that creates the table runs,
 * the entry just goes to the server log.
 */

export type AuditEntry = { id: number; autor: string; acao: string; detalhes: string | null; client_id: number | null; created_at: string };

export async function registrarAcao(autor: string | undefined, acao: string, detalhes?: string, clientId?: number) {
  const row = { autor: autor || "sistema", acao, detalhes: detalhes ?? null, client_id: clientId ?? null };
  console.log(`[auditoria] ${row.autor}: ${acao}${detalhes ? ` (${detalhes})` : ""}`);
  const { error } = await supabase.from("auditoria").insert(row);
  if (error) console.warn("[auditoria] Not saved:", error.message);
}

export async function listarAcoes(options: { limit: number; busca?: string }): Promise<{ entries: AuditEntry[]; ready: boolean }> {
  let query = supabase.from("auditoria").select("*").order("created_at", { ascending: false }).limit(options.limit);
  const busca = options.busca?.trim();
  if (busca) {
    // Commas and parentheses would break the filter syntax, so they are removed from the search.
    const term = busca.replace(/[,()%*]/g, " ").trim();
    if (term) query = query.or(`autor.ilike.%${term}%,acao.ilike.%${term}%,detalhes.ilike.%${term}%`);
  }
  const { data, error } = await query;
  if (error) {
    console.warn("[auditoria] Could not list:", error.message);
    return { entries: [], ready: false };
  }
  return { entries: (data ?? []) as AuditEntry[], ready: true };
}
