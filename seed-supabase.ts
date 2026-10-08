// Seed data into Supabase tables
import "dotenv/config";
import { createClient } from "@supabase/supabase-js";

const url = process.env.SUPABASE_URL ?? "";
const key = process.env.SUPABASE_SECRET_KEY ?? "";

const supabase = createClient(url, key, {
  auth: { persistSession: false, autoRefreshToken: false },
});

async function main() {
  console.log("Seeding Supabase...\n");

  // --- Clientes ---
  const { error: ce } = await supabase.from("clientes").upsert([
    { id: 1, name: "Joyce Gomes da Silva Rosa", cpf: "***.482.***-09", type: "Revisão de juros", status: "Em andamento", updated: "Hoje, 09:42", tone: "green", email: "joyce@example.com", phone: "(11) 99999-0001", services: ["Revisão de Juros"] },
    { id: 2, name: "Marcos Vinícius Almeida", cpf: "***.119.***-42", type: "Busca e apreensão", status: "Aguardando documento", updated: "Ontem, 16:18", tone: "yellow", email: "marcos@example.com", phone: "(11) 99999-0002", services: ["Busca e Apreensão"] },
    { id: 3, name: "Ana Paula Ferreira", cpf: "***.763.***-20", type: "Revisão de juros", status: "Em análise", updated: "26 set, 11:05", tone: "yellow", email: "ana@example.com", phone: "(11) 99999-0003", services: ["Revisão de Juros"] },
    { id: 4, name: "Rafael de Souza Lima", cpf: "***.058.***-73", type: "Portabilidade", status: "Concluído", updated: "25 set, 14:27", tone: "green", email: "rafael@example.com", phone: "(11) 99999-0004", services: ["Portabilidade"] },
    { id: 5, name: "Camila Rodrigues Santos", cpf: "***.391.***-64", type: "Revisão de contrato", status: "Atenção necessária", updated: "24 set, 10:12", tone: "red", email: "camila@example.com", phone: "(11) 99999-0005", services: ["Revisão de Contrato"] },
  ], { onConflict: "id" });
  console.log("clientes:", ce ? `✗ ${ce.message}` : "✓");

  // --- Chargebacks ---
  const { error: cbe } = await supabase.from("chargebacks").upsert([
    { id: 1, client: "Joyce Gomes da Silva Rosa", bank: "Banco Vértice", amount: "R$ 8.420,55", deadline: "03 out 2026", status: "Documentação enviada", tone: "blue" },
    { id: 2, client: "Marcos Vinícius Almeida", bank: "CredMais", amount: "R$ 4.890,00", deadline: "07 out 2026", status: "Em conferência", tone: "yellow" },
    { id: 3, client: "Ana Paula Ferreira", bank: "Banco União", amount: "R$ 12.164,30", deadline: "12 out 2026", status: "Aguardando assinatura", tone: "purple" },
  ], { onConflict: "id" });
  console.log("chargebacks:", cbe ? `✗ ${cbe.message}` : "✓");

  // --- Vendas ---
  const { error: ve } = await supabase.from("vendas").upsert([
    { id: 1, date: "28/09/2026", client: "Silvani Pereira Nunes", phone: "+55 63 99276-2023", consultants: ["Beatriz", "Juan"], product: "Revisão de Juros", status: "Pendente", cbk: false, gross: 1600, net: 1600, note: "" },
    { id: 2, date: "28/09/2026", client: "Carlos Henrique Ramos dos Santos", phone: "(81) 98767-0239", consultants: ["Bruno Alemão"], product: "Portabilidade", status: "OK", cbk: false, gross: 3840, net: 3840, note: "Contrato conferido" },
    { id: 3, date: "28/09/2026", client: "Pedro Adelar Gomes", phone: "(41) 9218-0655", consultants: ["Gaby Inácio", "Fernanda"], product: "Revisão de Juros", status: "Pendente", cbk: false, gross: 900, net: 900, note: "" },
    { id: 4, date: "25/09/2026", client: "Diego Junior Vieira Souza", phone: "31 99538-6202", consultants: ["Alexandre", "Isabella"], product: "Revisão de contrato", status: "Pendente", cbk: false, gross: 1500, net: 1500, note: "Retornar ao cliente" },
    { id: 5, date: "25/09/2026", client: "Valmir Pereira da Silva", phone: "94981871466", consultants: ["Ana G."], product: "Revisão de Juros", status: "Pendente", cbk: false, gross: 1000, net: 1000, note: "" },
    { id: 6, date: "24/09/2026", client: "Adimar Rosa da Silva", phone: "24 99816-0605", consultants: ["Ana G.", "Alexandre"], product: "Laudo", status: "Pendente", cbk: false, gross: 2100, net: 2100, note: "" },
    { id: 7, date: "23/09/2026", client: "Josue Feliz Batista", phone: "(14) 99603-8753", consultants: ["Arthur Panizza", "Juan"], product: "Revisão de contrato", status: "Pendente", cbk: false, gross: 5786, net: 5241, note: "" },
    { id: 8, date: "21/09/2026", client: "Fernanda Souza", phone: "62981313765", consultants: ["Rafaela"], product: "Portabilidade", status: "OK", cbk: false, gross: 540, net: 513, note: "" },
  ], { onConflict: "id" });
  console.log("vendas:", ve ? `✗ ${ve.message}` : "✓");

  // --- Mensagens ---
  const { error: me } = await supabase.from("mensagens").upsert([
    { id: 1, client_id: 1, client_name: "Joyce Gomes da Silva Rosa", sender: "client", text: "Bom dia, não tem nenhuma novidade no meu processo?", time: "09:42" },
    { id: 2, client_id: 1, client_name: "Joyce Gomes da Silva Rosa", sender: "team", text: "Bom dia, Joyce! A análise financeira foi concluída e já enviamos a documentação para a próxima etapa. Vou te avisar assim que houver atualização.", time: "09:51" },
  ], { onConflict: "id" });
  console.log("mensagens:", me ? `✗ ${me.message}` : "✓");

  // Verify counts
  console.log("\nRow counts:");
  for (const t of ["clientes", "chargebacks", "vendas", "mensagens"]) {
    const { count } = await supabase.from(t).select("*", { count: "exact", head: true });
    console.log(`  ${t}: ${count} rows`);
  }
}

main().catch(console.error);
