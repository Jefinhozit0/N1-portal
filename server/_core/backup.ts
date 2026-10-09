import { existsSync } from "node:fs";
import { mkdir, readdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { ENV } from "./env";
import { supabase } from "./supabase";

/**
 * Daily backup to a folder on this machine (BACKUP_DIR, default "backups").
 * - backups/AAAA-MM-DD/<tabela>.json: every row of every table, one folder per day, last 30 kept.
 * - backups/arquivos/...: the documents' files, copied once (they never change after upload).
 * - backups/AAAA-MM-DD/logins.json: e-mails and roles of the logins (never passwords).
 * Point BACKUP_DIR to a Google Drive or OneDrive folder to also have a copy off the notebook.
 * To bring rows back: scripts/restaurar-backup.ts.
 */

const TABLES = ["clientes", "chargebacks", "vendas", "mensagens", "documentos", "cliente_eventos", "consultores", "auditoria"];
const KEEP_DAYS = 30;
const PAGE = 1000;

const baseDir = () => path.resolve(ENV.backupDir);
const today = () => new Date().toLocaleDateString("sv-SE", { timeZone: "America/Sao_Paulo" }); // AAAA-MM-DD

async function dumpTable(table: string): Promise<unknown[] | null> {
  const rows: unknown[] = [];
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await supabase.from(table).select("*").order("id", { ascending: true }).range(from, from + PAGE - 1);
    if (error) {
      // A table from a migration that was not run yet: skip it.
      console.warn(`[backup] ${table}: ${error.message}`);
      return null;
    }
    rows.push(...(data ?? []));
    if (!data || data.length < PAGE) return rows;
  }
}

async function dumpLogins() {
  const logins: unknown[] = [];
  for (let page = 1; ; page++) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage: 1000 });
    if (error) throw error;
    for (const user of data.users) {
      const { first_access: _secret, ...appMetadata } = user.app_metadata ?? {};
      logins.push({ id: user.id, email: user.email, created_at: user.created_at, last_sign_in_at: user.last_sign_in_at, app_metadata: appMetadata, user_metadata: user.user_metadata });
    }
    if (data.users.length < 1000) return logins;
  }
}

/** Copies the documents' files that are not in the backup yet. */
async function copyDocumentFiles(documentos: { caminho?: string }[]) {
  let copied = 0;
  for (const doc of documentos) {
    if (!doc.caminho) continue;
    const target = path.join(baseDir(), "arquivos", ...doc.caminho.split("/"));
    if (existsSync(target)) continue;
    const { data, error } = await supabase.storage.from("documentos").download(doc.caminho);
    if (error || !data) {
      console.warn(`[backup] File ${doc.caminho}: ${error?.message}`);
      continue;
    }
    await mkdir(path.dirname(target), { recursive: true });
    await writeFile(target, Buffer.from(await data.arrayBuffer()));
    copied += 1;
  }
  return copied;
}

async function pruneOldDays() {
  const cutoff = Date.now() - KEEP_DAYS * 24 * 60 * 60 * 1000;
  for (const name of await readdir(baseDir())) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(name)) continue;
    if (Date.parse(`${name}T23:59:59Z`) < cutoff) await rm(path.join(baseDir(), name), { recursive: true, force: true });
  }
}

export function hasBackupForToday() {
  return existsSync(path.join(baseDir(), today(), "resumo.json"));
}

export async function runBackup() {
  const dir = path.join(baseDir(), today());
  await mkdir(dir, { recursive: true });
  const summary: Record<string, number | string> = { feito_em: new Date().toISOString() };

  for (const table of TABLES) {
    const rows = await dumpTable(table);
    if (rows === null) continue;
    await writeFile(path.join(dir, `${table}.json`), JSON.stringify(rows, null, 2));
    summary[table] = rows.length;
    if (table === "documentos") summary.arquivos_novos = await copyDocumentFiles(rows as { caminho?: string }[]);
  }
  const logins = await dumpLogins();
  await writeFile(path.join(dir, "logins.json"), JSON.stringify(logins, null, 2));
  summary.logins = logins.length;

  // Written last: its presence means the day's backup finished.
  await writeFile(path.join(dir, "resumo.json"), JSON.stringify(summary, null, 2));
  await pruneOldDays();
  console.log(`[backup] Done: ${dir}`);
  return { dir, summary };
}
