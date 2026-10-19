import { describe, expect, it, vi } from "vitest";

vi.mock("./supabase", () => ({ supabase: {} }));
vi.mock("./push", () => ({ sendPushToStaff: vi.fn() }));

const { newSalesPushText } = await import("./vendasNovas");

describe("newSalesPushText", () => {
  it("one sale: client, sector, values and consultants", () => {
    const text = newSalesPushText([{ id: 1, client: "Ana Souza", gross: 3900, net: 1200, setor: "comercial", consultants: ["Julia C", "Gaby Inácio"] }]);
    expect(text.title).toBe("Nova venda: Ana Souza");
    expect(text.body).toContain("Comercial");
    expect(text.body).toContain("Julia C, Gaby Inácio");
    expect(text.url).toBe("/?view=saleshub");
  });

  it("several sales become one notice with the totals per sector", () => {
    const text = newSalesPushText([
      { id: 1, client: "A", gross: 1000, net: 900, setor: "comercial", consultants: [] },
      { id: 2, client: "B", gross: 2000, net: 2000, setor: "juridico", consultants: [] },
      { id: 3, client: "C", gross: 500, net: 500, setor: null, consultants: null },
    ]);
    expect(text.title).toBe("3 novas vendas");
    expect(text.body).toContain("Comercial: 2");
    expect(text.body).toContain("Jurídico: 1");
    expect(text.body).toMatch(/bruto R\$\s3\.500,00/);
  });
});
