import { ENV } from "./env";
import { sendPushToStaff, type PushMessage } from "./push";
import { supabase } from "./supabase";

/**
 * App notice to the administrators whenever a sale goes into the system: from the Sales HUB,
 * from a script or straight in the database. Every minute it looks for sales newer than the last
 * one seen; several at once become a single notice. Sales that arrive while the server is off are
 * not announced when it comes back (the starting point is the newest sale at start-up).
 */

const CHECK_EVERY_MS = 60_000;
let lastSeenId: number | null = null;
let checking = false;

export type NewSale = { id: number; client: string; gross: number; net: number; setor: string | null; consultants: string[] | null };

const money = (value: number) => value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const sectorLabel = (setor: string | null) => (setor === "juridico" ? "Jurídico" : "Comercial");

export function newSalesPushText(sales: NewSale[]): PushMessage {
  const gross = sales.reduce((sum, sale) => sum + Number(sale.gross ?? 0), 0);
  const net = sales.reduce((sum, sale) => sum + Number(sale.net ?? 0), 0);
  const base = { url: "/?view=saleshub", tag: "vendas-novas" };
  if (sales.length === 1) {
    const [sale] = sales;
    const people = (sale.consultants ?? []).join(", ");
    return { ...base, title: `Nova venda: ${sale.client}`, body: `${sectorLabel(sale.setor)} · bruto ${money(gross)} · líquido ${money(net)}${people ? ` · ${people}` : ""}` };
  }
  const bySector = new Map<string, number>();
  for (const sale of sales) bySector.set(sectorLabel(sale.setor), (bySector.get(sectorLabel(sale.setor)) ?? 0) + 1);
  const sectors = Array.from(bySector, ([label, count]) => `${label}: ${count}`).join(" · ");
  return { ...base, title: `${sales.length} novas vendas`, body: `${sectors} · bruto ${money(gross)} · líquido ${money(net)}` };
}

/** Administrators: ADMIN_EMAILS plus team accounts with role "admin". */
async function adminEmails() {
  const emails = new Set(ENV.adminEmails);
  for (let page = 1; ; page++) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage: 1000 });
    if (error) break;
    for (const user of data.users) if (user.app_metadata?.role === "admin" && user.email) emails.add(user.email.toLowerCase());
    if (data.users.length < 1000) break;
  }
  return Array.from(emails);
}

/** Looks for sales newer than the last one seen and notifies the administrators. Never throws. */
export async function checkNewSales() {
  if (checking) return;
  checking = true;
  try {
    if (lastSeenId === null) {
      const { data, error } = await supabase.from("vendas").select("id").order("id", { ascending: false }).limit(1);
      if (!error) lastSeenId = (data?.[0]?.id as number | undefined) ?? 0;
      return;
    }
    const { data, error } = await supabase.from("vendas").select("id, client, gross, net, setor, consultants").gt("id", lastSeenId).order("id", { ascending: true }).limit(200);
    if (error || !data?.length) return;
    const sales = data as NewSale[];
    lastSeenId = sales[sales.length - 1].id;
    await sendPushToStaff(await adminEmails(), newSalesPushText(sales));
  } catch (error) {
    console.warn("[vendasNovas] Check failed:", error instanceof Error ? error.message : error);
  } finally {
    checking = false;
  }
}

export function startNewSalesWatch() {
  void checkNewSales();
  setInterval(() => void checkNewSales(), CHECK_EVERY_MS);
}
