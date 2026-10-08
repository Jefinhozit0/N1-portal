// Quick test script to check Supabase connection and list tables
import { createClient } from "@supabase/supabase-js";

const url = process.env.SUPABASE_URL ?? "";
const key = process.env.SUPABASE_SECRET_KEY ?? "";

console.log("Connecting to:", url);

const supabase = createClient(url, key, {
  auth: { persistSession: false, autoRefreshToken: false },
});

async function main() {
  // Try listing tables via RPC
  const { data: tables, error: tablesError } = await supabase
    .rpc("exec_sql", { sql: "SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' ORDER BY table_name;" })
    .limit(50);

  if (!tablesError && tables) {
    console.log("Tables via RPC:", tables);
    return;
  }

  // Alternative: try direct table access - test common tables
  const testTables = ["users", "clientes", "clients", "chargebacks", "vendas", "sales", "atendimentos", "messages"];
  for (const table of testTables) {
    const { data, error } = await supabase.from(table).select("*").limit(1);
    if (!error) {
      console.log(`✓ Table '${table}' exists. Sample:`, JSON.stringify(data?.[0] ?? "empty").slice(0, 120));
    } else if (!error.message.includes("does not exist") && !error.message.includes("relation") && !error.message.includes("permission")) {
      console.log(`? Table '${table}' error:`, error.message);
    }
  }
  
  // Test basic connection
  const { data: authData, error: authError } = await supabase.auth.getSession();
  if (authError) {
    console.error("Auth error:", authError.message);
  } else {
    console.log("Connection OK - Auth status:", authData.session ? "authenticated" : "anon");
  }
}

main().catch(console.error);
