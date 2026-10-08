// Script to apply schema to Supabase using the Management API
import { createClient } from "@supabase/supabase-js";
import fs from "node:fs";
import path from "node:path";

const url = process.env.SUPABASE_URL ?? "";
const key = process.env.SUPABASE_SECRET_KEY ?? "";

const supabase = createClient(url, key, {
  auth: { persistSession: false, autoRefreshToken: false },
});

// Read the SQL file
const sqlFile = path.join(process.cwd(), "supabase-schema.sql");
const fullSql = fs.readFileSync(sqlFile, "utf-8");

// Split into individual statements
const statements = fullSql
  .split(";")
  .map((s) => s.trim())
  .filter((s) => s.length > 0 && !s.startsWith("--"));

async function runStatement(sql: string) {
  const { data, error } = await supabase.rpc("exec_sql", { sql: sql + ";" });
  if (error) {
    // Try alternative approach
    return { data: null, error };
  }
  return { data, error: null };
}

async function main() {
  console.log(`Running ${statements.length} SQL statements...\n`);
  
  let success = 0;
  let failed = 0;
  
  for (const stmt of statements) {
    const preview = stmt.slice(0, 60).replace(/\n/g, " ");
    const { error } = await runStatement(stmt);
    if (error) {
      console.error(`✗ FAILED: ${preview}...\n  Error: ${error.message}\n`);
      failed++;
    } else {
      console.log(`✓ OK: ${preview}...`);
      success++;
    }
  }
  
  console.log(`\nDone: ${success} succeeded, ${failed} failed`);
  
  // Verify tables were created
  console.log("\nVerifying tables:");
  const tablesToCheck = ["clientes", "chargebacks", "vendas", "mensagens"];
  for (const table of tablesToCheck) {
    const { data, error, count } = await supabase.from(table).select("*", { count: "exact", head: true });
    if (error) {
      console.log(`  ${table}: ✗ ${error.message}`);
    } else {
      console.log(`  ${table}: ✓ (${count} rows)`);
    }
  }
}

main().catch(console.error);
