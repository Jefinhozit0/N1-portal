/**
 * Brings clients from the old system into the portal WITHOUT notifying them: rows go straight into
 * the database, so no login is created and no e-mail or WhatsApp goes out (the access reminders
 * only look at clients who already got a link). Send access later with "Reenviar acesso".
 *
 *   npx tsx scripts/importar-clientes.ts <clientes.json>            -> only shows what would happen
 *   npx tsx scripts/importar-clientes.ts <clientes.json> --gravar   -> writes to the database
 *
 * Each item: { name, cpf, phone, email, processo, status, progresso, created_at, atualizado_em }.
 * Clients whose CPF is already in the portal are skipped. Imported clients get the tag
 * "Sistema antigo" and keep their original registration and last-update dates.
 */
import "dotenv/config";
import { readFile } from "node:fs/promises";
import { createClient } from "@supabase/supabase-js";
import { OLD_SYSTEM_TAG, toneForStatus } from "../shared/processo";

type OldClient = {
  name: string;
  cpf: string;
  phone: string;
  email: string;
  processo: string;
  status: string;
  progresso: number;
  created_at: string;
  atualizado_em: string;
};

const TAG = OLD_SYSTEM_TAG;
/** Old system's status -> the portal's equivalent. Others keep their name. */
const STATUS_MAP: Record<string, string> = {
  "Tratativa suspensa": "Suspenso",
  "Andamento judicial": "Em andamento judicial",
};
/** Filler e-mails the old system used when the client had none. */
const PLACEHOLDER_EMAILS = new Set(["naoinformado@gmail.com"]);
const BATCH = 100;

const digits = (cpf: string | null) => (cpf ?? "").replace(/\D/g, "");

async function main() {
  const [file, flag] = process.argv.slice(2);
  if (!file) {
    console.log("Uso: npx tsx scripts/importar-clientes.ts <clientes.json> [--gravar]");
    process.exit(1);
  }
  const write = flag === "--gravar";
  const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SECRET_KEY!, { auth: { persistSession: false } });

  const items = JSON.parse(await readFile(file, "utf8")) as OldClient[];
  const { data: existing, error: listError } = await supabase.from("clientes").select("id, name, cpf");
  if (listError) throw listError;
  const known = new Map((existing ?? []).map((c) => [digits(c.cpf), c.name as string]));

  const skipped = items.filter((c) => known.has(digits(c.cpf)));
  const rows = items
    .filter((c) => !known.has(digits(c.cpf)))
    .map((c) => {
      const status = STATUS_MAP[c.status] ?? c.status;
      return {
        name: c.name,
        cpf: c.cpf,
        phone: c.phone || null,
        email: c.email && !PLACEHOLDER_EMAILS.has(c.email.toLowerCase()) ? c.email : null,
        type: c.processo,
        services: [c.processo],
        status,
        tone: toneForStatus(status),
        progresso: c.progresso,
        updated: "",
        tags: [TAG],
        created_at: c.created_at,
        atualizado_em: c.atualizado_em,
      };
    });

  console.log(`No arquivo: ${items.length}. Já no portal (pulados): ${skipped.length}. A importar: ${rows.length}.`);
  for (const c of skipped) console.log(`  pulado: ${c.name} (${c.cpf}) já existe como "${known.get(digits(c.cpf))}"`);
  const byStatus = rows.reduce<Record<string, number>>((acc, r) => ({ ...acc, [r.status]: (acc[r.status] ?? 0) + 1 }), {});
  console.log("Status no portal:", byStatus);
  console.log(`Sem e-mail (placeholder removido): ${rows.filter((r) => !r.email).map((r) => r.name).join(", ") || "nenhum"}`);
  if (!write) {
    console.log("\nNada foi gravado. Rode de novo com --gravar para importar.");
    return;
  }

  const insertedIds: number[] = [];
  for (let i = 0; i < rows.length; i += BATCH) {
    const chunk = rows.slice(i, i + BATCH);
    const { data, error } = await supabase.from("clientes").insert(chunk).select("id, type, created_at");
    if (error) throw new Error(`Lote ${i / BATCH + 1}: ${error.message} (já gravados: ${insertedIds.join(",") || "nenhum"})`);
    insertedIds.push(...data.map((c) => c.id as number));
    const events = data.map((c) => ({
      client_id: c.id,
      tipo: "cadastro",
      titulo: "Cadastro realizado",
      descricao: c.type ? `Início do processo: ${c.type}` : "Início do processo",
      autor: "Importação do sistema antigo",
      created_at: c.created_at,
    }));
    const { error: eventError } = await supabase.from("cliente_eventos").insert(events);
    if (eventError) console.warn(`Linha do tempo do lote ${i / BATCH + 1} não gravada: ${eventError.message}`);
    console.log(`  gravados ${insertedIds.length}/${rows.length}`);
  }

  await supabase.from("auditoria").insert({
    autor: "sistema",
    acao: "Importou clientes do sistema antigo",
    detalhes: `${insertedIds.length} clientes, sem envio de acesso (tag "${TAG}")`,
  });
  console.log(`\nPronto: ${insertedIds.length} clientes importados (ids ${Math.min(...insertedIds)} a ${Math.max(...insertedIds)}). Nenhuma mensagem enviada.`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
