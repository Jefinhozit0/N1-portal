/**
 * Brings rows back from the daily backup (pasta backups/AAAA-MM-DD).
 *
 *   npx tsx scripts/restaurar-backup.ts <pasta do dia> <tabela> [ids separados por vírgula]
 *
 * Examples:
 *   npx tsx scripts/restaurar-backup.ts backups/2026-10-09 clientes 7,8,9     -> só esses clientes
 *   npx tsx scripts/restaurar-backup.ts backups/2026-10-09 mensagens         -> todas as mensagens
 *
 * Rows that still exist are overwritten with the backup version (same id); missing ones come back.
 * Restore "clientes" before "mensagens", "documentos" and "cliente_eventos", which point to them.
 * Logins and passwords are not restored: send a new access link from the portal instead.
 * Files of documents are in backups/arquivos/ and must be uploaded again from the portal.
 */
import "dotenv/config";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { createClient } from "@supabase/supabase-js";

const TABLES = ["clientes", "chargebacks", "vendas", "mensagens", "documentos", "cliente_eventos", "consultores", "auditoria"];

async function main() {
  const [folder, table, idList] = process.argv.slice(2);
  if (!folder || !table || !TABLES.includes(table)) {
    console.log(`Uso: npx tsx scripts/restaurar-backup.ts <pasta do dia> <tabela> [ids]\nTabelas: ${TABLES.join(", ")}`);
    process.exit(1);
  }
  const rows = JSON.parse(await readFile(path.join(folder, `${table}.json`), "utf8")) as { id: number }[];
  const ids = idList ? new Set(idList.split(",").map((id) => Number(id.trim()))) : null;
  const selected = ids ? rows.filter((row) => ids.has(row.id)) : rows;
  if (selected.length === 0) {
    console.log("Nenhuma linha encontrada no backup com esses ids.");
    return;
  }

  const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SECRET_KEY!, { auth: { persistSession: false } });
  for (let start = 0; start < selected.length; start += 500) {
    const { error } = await supabase.from(table).upsert(selected.slice(start, start + 500), { onConflict: "id" });
    if (error) throw new Error(`Falhou em ${table}: ${error.message}`);
  }
  console.log(`${selected.length} linha(s) de ${table} restaurada(s) de ${folder}.`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
