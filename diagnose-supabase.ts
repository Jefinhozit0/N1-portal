// Try different API approaches to create tables
import "dotenv/config";
import https from "node:https";

const projectRef = new URL(process.env.SUPABASE_URL ?? "https://invalid.supabase.co").hostname.split(".")[0];
const serviceKey = process.env.SUPABASE_SECRET_KEY ?? "";
const supabaseUrl = process.env.SUPABASE_URL ?? "";

function httpRequest(url: string, method: string, body: string | null, headers: Record<string, string>): Promise<{ status: number; body: string }> {
  return new Promise((resolve, reject) => {
    const urlObj = new URL(url);
    const options = {
      hostname: urlObj.hostname,
      path: urlObj.pathname + urlObj.search,
      method,
      headers: {
        ...headers,
        ...(body ? { "Content-Length": Buffer.byteLength(body) } : {}),
      },
    };

    const req = https.request(options, (res) => {
      let data = "";
      res.on("data", (chunk) => (data += chunk));
      res.on("end", () => resolve({ status: res.statusCode ?? 0, body: data }));
    });
    req.on("error", reject);
    if (body) req.write(body);
    req.end();
  });
}

async function main() {
  const headers = {
    "apikey": serviceKey,
    "Authorization": `Bearer ${serviceKey}`,
    "Content-Type": "application/json",
    "Prefer": "return=minimal",
  };

  // Test 1: Check if API key works by pinging auth
  console.log("Test 1: Checking API key validity...");
  const r1 = await httpRequest(`${supabaseUrl}/auth/v1/settings`, "GET", null, {
    "apikey": serviceKey,
    "Authorization": `Bearer ${serviceKey}`,
  });
  console.log(`  Status: ${r1.status}, Body: ${r1.body.slice(0, 200)}`);

  // Test 2: Try to insert into a non-existent table to get error details
  console.log("\nTest 2: Test REST with clientes table...");
  const r2 = await httpRequest(`${supabaseUrl}/rest/v1/clientes?select=id&limit=1`, "GET", null, headers);
  console.log(`  Status: ${r2.status}, Body: ${r2.body.slice(0, 300)}`);

  // Test 3: List schemas
  console.log("\nTest 3: Test REST root...");
  const r3 = await httpRequest(`${supabaseUrl}/rest/v1/`, "GET", null, headers);
  console.log(`  Status: ${r3.status}, Body: ${r3.body.slice(0, 300)}`);
}

main().catch(console.error);
