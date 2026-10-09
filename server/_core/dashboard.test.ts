import { describe, expect, it, vi } from "vitest";

const NOW = Date.parse("2026-10-08T12:00:00Z");
const daysAgo = (n: number) => new Date(NOW - n * 86_400_000).toISOString();

const tables: Record<string, unknown[]> = {
  clientes: [
    { id: 1, name: "Ana", status: "Em andamento", tone: "green", created_at: daysAgo(30), atualizado_em: daysAgo(2) },
    { id: 2, name: "Bruno", status: "Aguardando documento", tone: "yellow", created_at: daysAgo(40), atualizado_em: daysAgo(20) },
    { id: 3, name: "Carla", status: "Atenção necessária", tone: "red", created_at: daysAgo(12), atualizado_em: daysAgo(12) },
    { id: 4, name: "Davi", status: "Concluído", tone: "green", created_at: daysAgo(90), atualizado_em: daysAgo(1) },
    { id: 5, name: "Elisa", status: "Suspenso", tone: "yellow", created_at: daysAgo(50), atualizado_em: daysAgo(50) },
    { id: 6, name: "Fábio Souza", status: "Em análise", tone: "green", created_at: daysAgo(5), atualizado_em: daysAgo(5) },
  ],
  chargebacks: [
    { client: "Ana", bank: "Banco A", amount: "R$ 1.000,00", deadline: "10 out 2026", status: "Em conferência", created_at: daysAgo(3) },
    { client: "Bruno", bank: "Banco B", amount: "R$ 3.000,50", deadline: "15/10/2026", status: "Revertido", created_at: daysAgo(10) },
    { client: "Carla", bank: "Banco C", amount: "R$ 2.000,00", deadline: "01 nov 2026", status: "Negado", created_at: daysAgo(8) },
  ],
  vendas: [
    { client: "Fabio Souza", product: "Revisão", cbk: true, created_at: daysAgo(4) },
    { client: "Ana", product: "Revisão", cbk: false, created_at: daysAgo(1) },
  ],
  mensagens: [
    // Bruno wrote, team answered, Bruno wrote again -> still waiting
    { client_id: 2, client_name: "Bruno", sender: "client", text: "Oi", created_at: daysAgo(15) },
    { client_id: 2, client_name: "Bruno", sender: "team", text: "Olá", created_at: daysAgo(14) },
    { client_id: 2, client_name: "Bruno", sender: "client", text: "Ticket · Documentos\nFalta algo?", created_at: daysAgo(1) },
    // Carla wrote and was answered -> answered conversation
    { client_id: 3, client_name: "Carla", sender: "client", text: "Novidades?", created_at: daysAgo(11) },
    { client_id: 3, client_name: "Carla", sender: "team", text: "Ainda não", created_at: daysAgo(11) },
  ],
};

vi.mock("./supabase", () => {
  const query = (table: string) => {
    const result = { data: tables[table], error: null };
    const chain: Record<string, unknown> = {};
    for (const method of ["select", "order", "limit", "in"]) chain[method] = () => chain;
    chain.then = (resolve: (value: unknown) => unknown) => resolve(result);
    return chain;
  };
  const users = [
    { email: "ana@x.com", app_metadata: { role: "client", terms: { version: "2026-10-v1", accepted_at: daysAgo(0.5) } }, user_metadata: { name: "Ana" }, last_sign_in_at: daysAgo(3) },
    { email: "bruno@x.com", app_metadata: { role: "client", terms: { version: "versao-antiga" } }, user_metadata: { name: "Bruno" }, last_sign_in_at: daysAgo(45) },
    { email: "carla@x.com", app_metadata: { role: "client" }, user_metadata: { name: "Carla" }, last_sign_in_at: null },
    { email: "equipe@x.com", app_metadata: {}, user_metadata: {}, last_sign_in_at: daysAgo(0) },
  ];
  return { supabase: { from: query, auth: { admin: { listUsers: async () => ({ data: { users }, error: null }) } } } };
});

const { computeDashboard, parseDeadline, parseMoney } = await import("./dashboard");

describe("dashboard parsing", () => {
  it("reads money and deadline formats used in the tables", () => {
    expect(parseMoney("R$ 8.420,55")).toBe(8420.55);
    expect(parseMoney("1500")).toBe(1500);
    expect(parseMoney("")).toBeNull();
    expect(parseDeadline("03 out 2026")?.toDateString()).toBe(new Date(2026, 9, 3).toDateString());
    expect(parseDeadline("15/10/2026")?.toDateString()).toBe(new Date(2026, 9, 15).toDateString());
    expect(parseDeadline("sem prazo")).toBeNull();
  });
});

describe("computeDashboard", () => {
  it("computes every card from the data", async () => {
    const { metrics, processos, chargebacks, prazos, atividade } = await computeDashboard(NOW);

    // Elisa (suspended) and Fábio (sale with chargeback, matched ignoring accents) are left out
    expect(metrics.desconsiderados).toBe(2);
    expect(metrics.concluidos).toBe(1);
    expect(metrics.ativos).toBe(3); // Ana, Bruno, Carla
    expect(metrics.andamento).toBe(2); // Carla is "atenção"
    expect(processos).toMatchObject({ andamento: 2, atencao: 1, concluidos: 1, total: 4, taxaConclusao: 0.25 });

    // Carla: last activity 11 days ago -> idle. Bruno: status 20 days old but wrote yesterday -> not idle, but stale.
    expect(metrics.ociosos).toBe(1);
    expect(metrics.semAtualizacao).toBe(1);

    expect(metrics.pendentes).toBe(1); // Bruno
    expect(metrics.conversao).toEqual({ respondidas: 1, total: 2, percent: 0.5 });

    expect(metrics.aceite).toEqual({ aceitos: 1, elegiveis: 3, percent: 1 / 3 });
    expect(metrics.ativos30d).toBe(1); // only Ana logged in within 30 days; team accounts don't count

    expect(metrics.cbkAbertos).toBe(1);
    expect(metrics.reversao).toEqual({ revertidos: 1, encerrados: 2, percent: 0.5 });
    expect(metrics.ticketCbk).toBeCloseTo(2000.1667, 3);
    expect(chargebacks.recuperadoNoAno).toBeCloseTo(3000.5);

    expect(metrics.prazosVencidos).toBe(0);
    const { listas } = await computeDashboard(NOW);
    expect(listas.clientes.ativos).toEqual([1, 2, 3]);
    expect(listas.clientes.ociosos).toEqual([3]);
    expect(listas.clientes.semAtualizacao).toEqual([2]);
    expect(listas.clientes.atencao).toEqual([3]);
    expect(listas.clientes.desconsiderados).toEqual([5, 6]);
    expect(prazos).toHaveLength(1); // closed chargebacks have no pending deadline
    expect(prazos[0]).toMatchObject({ client: "Ana", title: "Chargeback · Banco A", daysLeft: 2 });

    expect(atividade).toHaveLength(5);
    expect(atividade[0].title).toBe("Termos aceitos");
    expect(atividade.some((a) => a.title === "Ticket · Documentos")).toBe(true);
  });
});
