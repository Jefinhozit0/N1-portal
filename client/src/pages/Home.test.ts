import { describe, expect, it } from "vitest";
import { buildSalesHubCsv, hubMoney, type HubRankingItem, type HubSale } from "./salesHubData";

describe("Sales HUB helpers", () => {
  it("formats Brazilian currency for dashboard metrics", () => {
    expect(hubMoney(435827.29)).toBe("R$ 435.827,29");
  });

  it("formats zero chargebacks as Brazilian currency", () => {
    expect(hubMoney(0)).toBe("R$ 0,00");
  });

  it("builds a CSV with filtered sales and ranking sections", () => {
    const sales: HubSale[] = [{ id: 1, date: "28/09/2026", client: "Ana; Silva", phone: "999", consultants: ["João"], product: "Revisão", status: "OK", cbk: false, gross: 1000, net: 900, note: "" }];
    const ranking: HubRankingItem[] = [{ name: "João", count: 1, gross: 1000, net: 900 }];
    const csv = buildSalesHubCsv(sales, ranking);
    expect(csv).toContain("RANKING DE CONSULTORES");
    expect(csv).toContain('"Ana; Silva"');
    expect(csv).toContain('"João";"1";"1000";"900"');
  });
});
