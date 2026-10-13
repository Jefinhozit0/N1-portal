import { describe, expect, it } from "vitest";
import { caseSummary } from "@shared/processo";

const base = { name: "Rafael Souza", type: "Laudo", status: "Em análise", progress: 40 };

describe("caseSummary", () => {
  it("talks about the client in the third person for the team", () => {
    expect(caseSummary({ ...base, documents: [], events: [] }, "equipe"))
      .toBe('Rafael tem um processo de Laudo, com status "Em análise" e 40% de progresso. Nenhum documento anexado até agora.');
  });

  it("talks to the client directly and uses the newest document and event", () => {
    const text = caseSummary({
      ...base,
      documents: [{ created_at: "2026-10-10T15:00:00Z" }, { created_at: "2026-10-01T15:00:00Z" }],
      events: [{ titulo: "Status atualizado", created_at: "2026-10-12T15:00:00Z" }],
    }, "cliente");
    expect(text).toBe('Seu processo de Laudo está com status "Em análise" e 40% de progresso. 2 documentos anexados, o mais recente em 10/10/2026. Última movimentação: status atualizado em 12/10/2026.');
  });

  it("fills in missing type and status", () => {
    expect(caseSummary({ name: "Ana", progress: 0, documents: [], events: [] }, "cliente"))
      .toBe('Seu processo de tipo ainda não definido está com status "sem status" e 0% de progresso. A equipe ainda não anexou documentos.');
  });
});
