import { getClienteId, provisionClientAccess } from "./clientAccess";
import { registrarAcao } from "./auditoria";
import { getPublicUrl } from "./publicUrl";
import { supabase } from "./supabase";

/**
 * Automatic reminder: a client who got the first-access link REMINDER_AFTER_MS ago and still has
 * not created the password gets a new link once, by e-mail and WhatsApp. The new link replaces
 * the old one. Links sent before this feature existed (no sent_at) are left alone.
 */

const REMINDER_AFTER_MS = 2 * 24 * 60 * 60 * 1000;
/** Only during the day in Brazil, so nobody gets a message at 3 a.m. */
const SEND_FROM_HOUR = 9;
const SEND_UNTIL_HOUR = 20;

function brazilHour() {
  return Number(new Date().toLocaleString("en-US", { hour: "numeric", hour12: false, timeZone: "America/Sao_Paulo" }));
}

export async function sendAccessReminders(): Promise<number> {
  const hour = brazilHour();
  if (hour < SEND_FROM_HOUR || hour >= SEND_UNTIL_HOUR) return 0;

  const due: { clienteId: number }[] = [];
  for (let page = 1; ; page++) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage: 1000 });
    if (error) throw error;
    for (const user of data.users) {
      const clienteId = getClienteId(user);
      const access = user.app_metadata?.first_access as { sent_at?: string; expires_at?: string; reminded?: boolean } | null | undefined;
      if (clienteId === null || !access?.sent_at || access.reminded) continue;
      if (Date.now() - Date.parse(access.sent_at) < REMINDER_AFTER_MS) continue;
      due.push({ clienteId });
    }
    if (data.users.length < 1000) break;
  }
  if (due.length === 0) return 0;

  const portalUrl = await getPublicUrl();
  let sent = 0;
  for (const { clienteId } of due) {
    const { data: cliente } = await supabase.from("clientes").select("id, name, email, phone").eq("id", clienteId).maybeSingle();
    if (!cliente?.email) continue;
    const result = await provisionClientAccess(cliente, portalUrl, { reminder: true });
    if (result.email.sent || result.whatsapp.sent) {
      sent += 1;
      await registrarAcao("sistema", "Lembrete de acesso enviado", cliente.name, cliente.id);
    }
  }
  return sent;
}
